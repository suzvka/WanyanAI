'use server';

import { createLogger } from '@/lib/api-station/logger';
import { ProgressController, type ProgressStage } from '@/features/analysis-progress';
import {
  buildAnalysisMessages,
  buildValidationRetryMessage,
  requestCompiledInstructions,
  requestCompiledMcpPrompt,
} from '@/features/analysis-flow/lib';
import { modelClient } from '@/services/model-client';
import {
  getServerOutputModePrompt,
  getOutputModeTools,
  resolveOutputModeToolCall,
  assembleOutputModeData,
  validateOutputModeData,
  buildOutputModeScoringContext,
} from '@/server/output-modes';
import { createAppError } from '@/types/errors';
import type { PersistedAnalysisReport } from '@/types/analysis';
import type { RuntimeAnalysisTask } from './types';

const logger = createLogger('runAnalysisTask');

const MAX_VALIDATION_REPAIR_ATTEMPTS = 1;

type OutputModeValidationError = {
  path: string;
  message: string;
};

type CapturedToolCall = {
  name: string;
  params: Record<string, unknown>;
};

function summarizeValidationErrors(errors?: OutputModeValidationError[]): string {
  if (!errors || errors.length === 0) {
    return '未知结构错误';
  }

  return errors
    .map((error) => {
      const path = error.path || '(root)';
      return `${path}: ${error.message}`;
    })
    .join(', ');
}

async function resolveToolData(
  task: RuntimeAnalysisTask,
  toolCall: CapturedToolCall,
): Promise<Record<string, unknown>> {
  if (toolCall.name === 'multi_collect_complete') {
    logger.debug('Multi-collect mode, assembling data', { toolNames: Object.keys(toolCall.params) });

    const assembledData = assembleOutputModeData(
      task.moduleConfig.manifest.outputMode,
      toolCall.params as Record<string, unknown[]>
    );

    if (!assembledData.success) {
      throw createAppError({
        code: 'validation_failed',
        message: `报告数据拼装失败：${assembledData.error}`,
        retryable: false,
      });
    }

    const toolData = assembledData.data!;
    logger.debug('Assembled data', { keys: Object.keys(toolData) });
    return toolData;
  }

  const resolution = resolveOutputModeToolCall(
    task.moduleConfig.manifest.outputMode,
    toolCall.name,
    toolCall.params
  );

  switch (resolution.type) {
    case 'data': {
      return resolution.data ?? {};
    }

    case 'abort': {
      logger.error('Workflow aborted', undefined, { reason: resolution.reason });
      throw createAppError({
        code: 'provider_response_invalid',
        message: `分析中止：${resolution.reason} - ${resolution.message}`,
        retryable: false,
      });
    }

    case 'finalize': {
      logger.debug('Finalize triggered, assembling data', { toolName: toolCall.name });
      const assembledData = assembleOutputModeData(
        task.moduleConfig.manifest.outputMode,
        {} as Record<string, unknown[]>
      );
      if (!assembledData.success) {
        throw createAppError({
          code: 'validation_failed',
          message: `报告数据拼装失败：${assembledData.error}`,
          retryable: false,
        });
      }
      return assembledData.data ?? {};
    }

    case 'unknown':
    default: {
      logger.error('Unknown tool name', undefined, { toolName: toolCall.name });
      throw createAppError({
        code: 'provider_response_invalid',
        message: `检测到未知工具调用：${toolCall.name}`,
        retryable: true,
      });
    }
  }
}


export const DEFAULT_PROGRESS_STAGES: ProgressStage[] = [
  {
    name: 'prepare',
    label: '准备输入',
    events: [{ type: 'prepare', label: '任务开始' }],
    weight: 1,
  },
  {
    name: 'fetch-template',
    label: '获取模板',
    events: [{ type: 'fetch-template', label: '同步分析配置' }],
    weight: 1,
  },
  {
    name: 'build-prompt',
    label: '构建提示词',
    events: [{ type: 'build-prompt', label: '拼接请求参数' }],
    weight: 1,
  },
  {
    name: 'request-model',
    label: 'AI分析中...',
    events: [
      { type: 'request-model', weight: 1, label: '上传请求' },
      { type: 'first-token', weight: 1, label: '开始接收响应' },
      { type: 'think-start', weight: 1, label: '正在思索...' },
      { type: 'content-start', weight: 6, label: '正在起草报告...' },
    ],
    weight: 8,
  },
  {
    name: 'parse-mcp',
    label: '提取工具调用',
    events: [{ type: 'parse-mcp', label: '解析工具调用' }],
    weight: 1,
  },
  {
    name: 'invoke-tool',
    label: '执行工具',
    events: [{ type: 'invoke-tool', label: '调用提交工具' }],
    weight: 1,
  },
  {
    name: 'normalize',
    label: '生成报告',
    events: [{ type: 'normalize', label: '提交报告' }],
    weight: 1,
  },
];

export async function runAnalysisTask(
  task: RuntimeAnalysisTask,
  progressController: ProgressController,
): Promise<PersistedAnalysisReport> {
  logger.info('Task started', {
    taskId: task.id,
    model: task.modelConfig.selectedModel,
    moduleId: task.moduleConfig.manifest.slug,
  });

  progressController.handleEvent({ type: 'workflow-stage', stage: 'prepare', timestamp: Date.now() });

  const compiledInstructions = await requestCompiledInstructions({
    controlSelections: task.controlSelections,
    configVersion: task.moduleConfig.manifest.slug,
  });

  progressController.handleEvent({ type: 'workflow-stage', stage: 'fetch-template', timestamp: Date.now() });

  const systemPrompt = getServerOutputModePrompt(task.moduleConfig.manifest.outputMode);
  if (!systemPrompt) {
    throw createAppError({ code: 'config_invalid', message: `Output mode "${task.moduleConfig.manifest.outputMode}" not found or has no prompt` });
  }

  const compiledMcpPrompt = await requestCompiledMcpPrompt({
    outputModeId: task.moduleConfig.manifest.outputMode,
  });

  progressController.handleEvent({ type: 'workflow-stage', stage: 'build-prompt', timestamp: Date.now() });

  const { messages: initialMessages } = buildAnalysisMessages({
    input: task.input,
    systemPrompt,
    instructionText: compiledInstructions.instructionText,
    mcpToolText: compiledMcpPrompt.toolPromptText,
    containers: task.moduleConfig.manifest.containers,
  });

  const resolvedSystemPrompt = initialMessages.find(m => m.role === 'system')?.content || '';
  const userPrompt = initialMessages.find(m => m.role === 'user')?.content || '';

  logger.debug('Prompt analysis', {
    outputMode: task.moduleConfig.manifest.outputMode,
    systemPromptLength: resolvedSystemPrompt.length,
    userPromptLength: userPrompt.length,
    hasLanguageExpression: resolvedSystemPrompt.includes('language_expression'),
    hasStructuralLogic: resolvedSystemPrompt.includes('structural_logic'),
    hasReadability: resolvedSystemPrompt.includes('readability'),
    hasNarrativeCoherence: resolvedSystemPrompt.includes('narrative_coherence'),
  });

  if (!task.modelConfig.baseUrl) {
    throw createAppError({
      code: 'config_invalid',
      message: '模型配置缺少 baseUrl',
      retryable: false,
    });
  }
  if (!task.modelConfig.apiKey) {
    throw createAppError({
      code: 'config_invalid',
      message: '模型配置缺少 apiKey',
      retryable: false,
    });
  }
  if (!task.modelConfig.selectedModel) {
    throw createAppError({
      code: 'config_invalid',
      message: '未选择模型',
      retryable: false,
    });
  }

  logger.debug('Fetching MCP tool definitions', { outputMode: task.moduleConfig.manifest.outputMode });
  const mcpToolDefinitions = getOutputModeTools(task.moduleConfig.manifest.outputMode);
  logger.debug('MCP tools loaded', { toolCount: mcpToolDefinitions.length, toolNames: mcpToolDefinitions.map(t => t.name) });

  let attemptMessages = [...initialMessages];
  let finalValidationData: unknown;
  let completedAttempt = 0;

  for (let attempt = 0; attempt <= MAX_VALIDATION_REPAIR_ATTEMPTS; attempt += 1) {
    logger.debug('Starting model attempt', {
      taskId: task.id,
      attempt: attempt + 1,
      maxAttempts: MAX_VALIDATION_REPAIR_ATTEMPTS + 1,
    });

    progressController.handleEvent({ type: 'workflow-stage', stage: 'request-model', timestamp: Date.now() });

    const result = await modelClient.call({
      baseUrl: task.modelConfig.baseUrl,
      apiKey: task.modelConfig.apiKey,
      model: task.modelConfig.selectedModel,
      messages: attemptMessages,
      temperature: 0.7,
      events: progressController.createEventHandlers(),
      mcpToolDefinitions,
    });

    progressController.handleEvent({ type: 'workflow-stage', stage: 'parse-mcp', timestamp: Date.now() });

    const toolCall = result.toolCall;

    logger.debug('Tool call result', {
      taskId: task.id,
      attempt: attempt + 1,
      toolCallFound: !!toolCall,
      toolName: toolCall?.name,
    });

    if (!toolCall) {
      logger.error('No tool call detected');
      throw createAppError({
        code: 'provider_response_invalid',
        message: '未检测到有效的 MCP 工具调用，请确保模型正确调用了工具',
        retryable: true,
      });
    }

    const toolData = await resolveToolData(task, toolCall as CapturedToolCall);

    progressController.handleEvent({ type: 'workflow-stage', stage: 'invoke-tool', timestamp: Date.now() });

    logger.debug('Tool data summary', {
      attempt: attempt + 1,
      hasSummary: !!toolData.summary,
      subscoresCount: (toolData.subscores as unknown[])?.length || 0,
      hasConclusion: !!(toolData.conclusion as { rationale?: string })?.rationale,
      sectionsCount: (toolData.sections as unknown[])?.length || 0,
    });

    const validation = validateOutputModeData(task.moduleConfig.manifest.outputMode, toolData);
    if (validation.success) {
      finalValidationData = validation.data;
      completedAttempt = attempt + 1;
      logger.info('Validation succeeded', {
        taskId: task.id,
        attempt: attempt + 1,
      });
      break;
    }

    const validationSummary = summarizeValidationErrors(validation.errors);
    const canRetry = attempt < MAX_VALIDATION_REPAIR_ATTEMPTS;

    logger.warn('Validation failed', {
      taskId: task.id,
      attempt: attempt + 1,
      canRetry,
      errorCount: validation.errors?.length || 0,
    });

    if (!canRetry) {
      throw createAppError({
        code: 'validation_failed',
        message: `输出模式数据验证失败：${validationSummary}`,
        retryable: false,
      });
    }

    attemptMessages = [
      ...attemptMessages,
      {
        role: 'user',
        content: buildValidationRetryMessage({
          outputModeId: task.moduleConfig.manifest.outputMode,
          issues: validation.errors ?? [],
          previousReportData: toolData,
          attempt,
          maxAttempts: MAX_VALIDATION_REPAIR_ATTEMPTS,
        }),
      },
    ];

    logger.debug('Scheduling repair retry', {
      taskId: task.id,
      nextAttempt: attempt + 2,
      validationSummary,
    });
  }

  if (finalValidationData === undefined) {
    throw createAppError({
      code: 'validation_failed',
      message: '输出模式数据验证失败：修复重试后仍未得到合法报告',
      retryable: false,
    });
  }

  const createdAt = new Date().toISOString();
  const scoringContext = buildOutputModeScoringContext(task.moduleConfig.manifest.outputMode, {
    moduleConfig: task.moduleConfig,
    controlSelections: task.controlSelections,
  });

  const analysisResult: PersistedAnalysisReport = {
    reportId: task.id,
    moduleId: task.moduleConfig.manifest.slug,
    outputMode: task.moduleConfig.manifest.outputMode,
    createdAt,
    rawJson: finalValidationData as Record<string, unknown>,
    metadata: {
      model: task.modelConfig.selectedModel,
      baseUrl: task.modelConfig.baseUrl,
      outputMode: task.moduleConfig.manifest.outputMode,
      moduleId: task.moduleConfig.manifest.slug,
    },
    scoringContext: scoringContext ?? { multipliers: {}, defaultMultiplier: 1 },
  };

  progressController.handleEvent({ type: 'workflow-stage', stage: 'normalize', timestamp: Date.now() });

  logger.info('Analysis completed successfully', {
    taskId: task.id,
    reportId: analysisResult.reportId,
    completedAttempt,
  });

  return analysisResult;
}
