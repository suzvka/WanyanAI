import { ProgressController, type ProgressStage } from '@/features/analysis-progress';
import {
  buildAnalysisMessages,
  buildValidationRetryMessage,
  requestCompiledInstructions,
  requestCompiledMcpPrompt,
} from '@/features/analysis-flow/lib';
import { modelClient } from '@/services/model-client';
import { ApiAnalysisService } from '@/services/analysis/apiAnalysisService';
import { requestJson } from '@/lib/client-request';
import { createAppError } from '@/types/errors';
import type { PersistedAnalysisReport, ReportScoringContext } from '@/types/analysis';
import type { RuntimeAnalysisTask } from './types';
import type { ModuleConfig } from '@/types/module';
import type { McpToolDefinition } from '@/mcp/types';

const templateService = new ApiAnalysisService();

/**
 * 通过 API Route 获取输出模式工具定义
 */
async function apiGetOutputModeToolDefinitions(
  outputModeId: string
): Promise<McpToolDefinition[]> {
  const result = await requestJson<{ success?: boolean; data?: { tools?: any[] } }>(`/api/output-modes/tools?outputModeId=${outputModeId}`, {
    errorMessage: '获取输出模式工具定义失败',
    networkErrorMessage: '获取输出模式工具定义失败，请检查网络后重试',
  });
  
  if (result.success && result.data?.tools) {
    // 将 API 返回的工具描述转换为 McpToolDefinition 格式
    // 注意：handler 需要在客户端重新定义
    return result.data.tools.map((tool: any) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
      inputSchema: null as any, // 客户端不需要验证
      handler: (params: Record<string, unknown>) => {
        // abort_workflow 需要设置 terminate 标志
        if (tool.name === 'abort_workflow') {
          return {
            ok: true,
            data: params,
            message: '工作流已中止',
            terminate: true,
          };
        }
        // finalize_report 需要设置 terminate 标志
        if (tool.name === 'finalize_report') {
          return {
            ok: true,
            data: { finalized: true },
            message: '报告已完成',
            terminate: true,
          };
        }
        return {
          ok: true,
          data: params,
          message: '数据已收集',
        };
      },
    }));
  }
  
  return [];
}

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
    console.log('[runAnalysisTask] Multi-collect mode, assembling data...');
    console.log('[runAnalysisTask] Collected data:', JSON.stringify(toolCall.params, null, 2));

    const assembledData = await apiAssembleOutputModeData(
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
    console.log('[runAnalysisTask] Assembled data:', JSON.stringify(toolData, null, 2));
    return toolData;
  }

  if (toolCall.name === 'submit_report') {
    return toolCall.params;
  }

  if (toolCall.name === 'abort_workflow') {
    console.error('[runAnalysisTask] Workflow aborted:', toolCall.params);
    const params = toolCall.params as { reason: string; message: string };
    throw createAppError({
      code: 'provider_response_invalid',
      message: `分析中止：${params.reason} - ${params.message}`,
      retryable: false,
    });
  }

  console.error('[runAnalysisTask] Unknown tool name:', toolCall.name);
  throw createAppError({
    code: 'provider_response_invalid',
    message: `检测到未知工具调用：${toolCall.name}`,
    retryable: true,
  });
}

/**
 * 通过 API Route 拼装输出模式数据（绕过 Server Actions 验证）
 */
async function apiAssembleOutputModeData(
  outputModeId: string,
  collectedData: Record<string, unknown[]>
): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> {
  return requestJson<{ success: boolean; data?: Record<string, unknown>; error?: string }>('/api/output-modes/assemble', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ outputModeId, collectedData }),
    errorMessage: '拼装输出模式数据失败',
    networkErrorMessage: '拼装输出模式数据失败，请检查网络后重试',
  });
}

/**
 * 通过 API Route 验证输出模式数据（绕过 Server Actions 验证）
 */
async function apiValidateOutputModeData(
  outputModeId: string,
  data: unknown
): Promise<{ success: boolean; data?: unknown; errors?: Array<{ path: string; message: string }> }> {
  return requestJson<{ success: boolean; data?: unknown; errors?: Array<{ path: string; message: string }> }>('/api/output-modes/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ outputModeId, data }),
    errorMessage: '校验输出模式数据失败',
    networkErrorMessage: '校验输出模式数据失败，请检查网络后重试',
  });
}

/**
 * 通过 API Route 构建评分上下文（绕过 Server Actions 验证）
 */
async function apiBuildOutputModeScoringContext(
  outputModeId: string,
  params: { moduleConfig: ModuleConfig; controlSelections: Record<string, string> }
): Promise<ReportScoringContext> {
  const result = await requestJson<{ success?: boolean; data?: ReportScoringContext }>('/api/output-modes/scoring-context', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ outputModeId, params }),
    errorMessage: '构建评分上下文失败',
    networkErrorMessage: '构建评分上下文失败，请检查网络后重试',
  });

  if (result.success) {
    return result.data as ReportScoringContext;
  }
  // 返回默认值
  return { multipliers: {}, defaultMultiplier: 1 };
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
  console.log('[runAnalysisTask] Task started:', {
    taskId: task.id,
    model: task.modelConfig.selectedModel,
    moduleId: task.moduleConfig.manifest.id,
  });

  progressController.handleEvent({ type: 'workflow-stage', stage: 'prepare', timestamp: Date.now() });

  const compiledInstructions = await requestCompiledInstructions({
    controlSelections: task.controlSelections,
    configVersion: task.moduleConfig.manifest.id,
  });

  progressController.handleEvent({ type: 'workflow-stage', stage: 'fetch-template', timestamp: Date.now() });

  const template = await templateService.getTemplate({
    evaluationGoal: task.input.evaluationGoal,
    outputMode: task.moduleConfig.manifest.outputMode,
  });

  const compiledMcpPrompt = await requestCompiledMcpPrompt({
    outputModeId: task.moduleConfig.manifest.outputMode,
  });

  progressController.handleEvent({ type: 'workflow-stage', stage: 'build-prompt', timestamp: Date.now() });

  const { messages: initialMessages } = buildAnalysisMessages({
    input: task.input,
    template,
    instructionText: compiledInstructions.instructionText,
    mcpToolText: compiledMcpPrompt.toolPromptText,
    containers: task.moduleConfig.manifest.containers,
  });

  // 添加详细调试日志
  const systemPrompt = initialMessages.find(m => m.role === 'system')?.content || '';
  const userPrompt = initialMessages.find(m => m.role === 'user')?.content || '';

  console.log('[runAnalysisTask] ========== DEBUG: Prompt Analysis ==========');
  console.log('[runAnalysisTask] Module outputMode:', task.moduleConfig.manifest.outputMode);
  console.log('[runAnalysisTask] System prompt length:', systemPrompt.length);
  console.log('[runAnalysisTask] System prompt contains language_expression:', systemPrompt.includes('language_expression'));
  console.log('[runAnalysisTask] System prompt contains structural_logic:', systemPrompt.includes('structural_logic'));
  console.log('[runAnalysisTask] System prompt contains readability:', systemPrompt.includes('readability'));
  console.log('[runAnalysisTask] System prompt contains narrative_coherence:', systemPrompt.includes('narrative_coherence'));
  console.log('[runAnalysisTask] User prompt length:', userPrompt.length);
  console.log('[runAnalysisTask] MCP tool text:', compiledMcpPrompt.toolPromptText);
  console.log('[runAnalysisTask] Instruction text:', compiledInstructions.instructionText);
  console.log('[runAnalysisTask] ========== END DEBUG ==========');

  // 参数验证
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

  // 获取输出模式工具定义
  console.log('[runAnalysisTask] Fetching MCP tool definitions for:', task.moduleConfig.manifest.outputMode);
  const mcpToolDefinitions = await apiGetOutputModeToolDefinitions(task.moduleConfig.manifest.outputMode);
  console.log('[runAnalysisTask] MCP tools loaded:', mcpToolDefinitions.map(t => t.name));
  let attemptMessages = [...initialMessages];
  let finalValidationData: unknown;
  let completedAttempt = 0;

  for (let attempt = 0; attempt <= MAX_VALIDATION_REPAIR_ATTEMPTS; attempt += 1) {
    console.log('[runAnalysisTask] Starting model attempt:', {
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
      temperature: template.recommendedParameters.temperature,
      events: progressController.createEventHandlers(),
      mcpToolDefinitions,
    });

    progressController.handleEvent({ type: 'workflow-stage', stage: 'parse-mcp', timestamp: Date.now() });

    const toolCall = result.toolCall;

    console.log('[runAnalysisTask] Tool call result:', {
      taskId: task.id,
      attempt: attempt + 1,
      toolCallFound: !!toolCall,
      toolName: toolCall?.name,
    });

    if (!toolCall) {
      console.error('[runAnalysisTask] No tool call detected');
      throw createAppError({
        code: 'provider_response_invalid',
        message: '未检测到有效的 MCP 工具调用，请确保模型正确调用了工具',
        retryable: true,
      });
    }

    const toolData = await resolveToolData(task, toolCall as CapturedToolCall);

    progressController.handleEvent({ type: 'workflow-stage', stage: 'invoke-tool', timestamp: Date.now() });

    console.log('[runAnalysisTask] Tool data summary:', {
      attempt: attempt + 1,
      hasSummary: !!toolData.summary,
      subscoresCount: (toolData.subscores as unknown[])?.length || 0,
      hasConclusion: !!(toolData.conclusion as { rationale?: string })?.rationale,
      sectionsCount: (toolData.sections as unknown[])?.length || 0,
    });

    const validation = await apiValidateOutputModeData(task.moduleConfig.manifest.outputMode, toolData);
    if (validation.success) {
      finalValidationData = validation.data;
      completedAttempt = attempt + 1;
      console.log('[runAnalysisTask] Validation succeeded:', {
        taskId: task.id,
        attempt: attempt + 1,
      });
      break;
    }

    const validationSummary = summarizeValidationErrors(validation.errors);
    const canRetry = attempt < MAX_VALIDATION_REPAIR_ATTEMPTS;

    console.warn('[runAnalysisTask] Validation failed:', {
      taskId: task.id,
      attempt: attempt + 1,
      canRetry,
      errors: validation.errors,
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

    console.log('[runAnalysisTask] Scheduling repair retry:', {
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
  const scoringContext = await apiBuildOutputModeScoringContext(task.moduleConfig.manifest.outputMode, {
    moduleConfig: task.moduleConfig,
    controlSelections: task.controlSelections,
  });

  const analysisResult: PersistedAnalysisReport = {
    reportId: task.id,
    moduleId: task.moduleConfig.manifest.id,
    outputMode: task.moduleConfig.manifest.outputMode,
    createdAt,
    rawJson: finalValidationData as Record<string, unknown>,
    metadata: {
      model: task.modelConfig.selectedModel,
      baseUrl: task.modelConfig.baseUrl,
      templateVersion: template.version,
      scoringPolicyVersion: template.policyMeta.scoringPolicyVersion,
      conclusionPolicyVersion: template.policyMeta.conclusionPolicyVersion,
      evaluationGoal: task.input.evaluationGoal,
    },
    scoringContext: scoringContext ?? { multipliers: {}, defaultMultiplier: 1 },
  };

  progressController.handleEvent({ type: 'workflow-stage', stage: 'normalize', timestamp: Date.now() });

  console.log('[runAnalysisTask] Analysis completed successfully:', {
    taskId: task.id,
    reportId: analysisResult.reportId,
    completedAttempt,
  });

  return analysisResult;
}
