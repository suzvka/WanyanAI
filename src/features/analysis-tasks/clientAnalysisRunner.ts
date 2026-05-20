/**
 * 客户端分析执行器
 *
 * 完全在客户端执行，不向服务端传递 API Key。
 *
 * 流程：
 * 1. 从服务端获取资源（提示词、编译结果等）
 * 2. 客户端直接获取 MCP 工具定义
 * 3. 使用客户端持有的 Key 调用模型
 * 4. 处理流式响应和进度事件
 * 5. 验证结果并返回报告
 */

import { modelClient } from '@/services/model-client';
import { ProgressController } from '@/features/analysis-progress';
import {
  getAnalysisResources,
  getStepResources,
  validateAnalysisOutput,
  buildScoringContext,
  buildRetryMessage,
} from '@/features/analysis-tasks/getAnalysisResources';
import { getOutputModeMcpTools } from '@/features/output-modes';
import { buildAnalysisMessages } from '@/features/analysis-flow/lib/buildAnalysisMessages';
import type { ModelConfig } from '@/types/modelConfig';
import type { PageModuleConfig } from '@/types/module';
import type { ControlSelections } from '@/providers/PageContext';
import type { EvaluationInput } from '@/types/report';
import type { PersistedAnalysisReport, ReportScoringContext } from '@/types/analysis';
import { DEFAULT_SCORING_CONTEXT } from '@/types/analysis';
import type { ProgressStage } from '@/features/analysis-progress';
import type { AgentStepResult } from '@/features/agent/types';

const MAX_VALIDATION_REPAIR_ATTEMPTS = 1;

// 客户端调试日志
const clientLog = (message: string, data?: unknown) => {
  console.log(`[clientAnalysisRunner] ${message}`, data !== undefined ? data : '');
};

/**
 * 默认进度阶段定义
 */
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

/**
 * 分析任务输入参数
 */
export interface ClientAnalysisInput {
  taskId: string;
  moduleConfig: PageModuleConfig;
  modelConfig: ModelConfig;
  controlSelections: ControlSelections;
  input: EvaluationInput;
}

/**
 * 分析任务结果
 */
export interface ClientAnalysisResult {
  success: boolean;
  report?: PersistedAnalysisReport;
  error?: string;
}

/**
 * 构建分析报告
 */
function buildReport(params: {
  reportId: string;
  moduleId: string;
  outputMode: string;
  data: unknown;
  modelConfig: ModelConfig;
  scoringContext: ReportScoringContext | undefined;
}): PersistedAnalysisReport {
  return {
    reportId: params.reportId,
    moduleId: params.moduleId,
    outputMode: params.outputMode,
    createdAt: new Date().toISOString(),
    rawJson: params.data as Record<string, unknown>,
    metadata: {
      model: params.modelConfig.selectedModel,
      baseUrl: params.modelConfig.baseUrl,
      outputMode: params.outputMode,
      moduleId: params.moduleId,
    },
    scoringContext: params.scoringContext ?? DEFAULT_SCORING_CONTEXT,
  };
}

/**
 * 执行分析任务
 *
 * 完全在客户端执行，不向服务端传递 API Key。
 */
export async function runClientAnalysis(
  input: ClientAnalysisInput,
  progressController: ProgressController
): Promise<ClientAnalysisResult> {
  const { taskId, moduleConfig, modelConfig, controlSelections, input: evaluationInput } = input;

  try {
    // === 阶段 1: 准备资源 ===
    progressController.handleEvent({ type: 'workflow-stage', stage: 'prepare', timestamp: Date.now() });

    // 验证模型配置
    if (!modelConfig.baseUrl) {
      return { success: false, error: '模型配置缺少 baseUrl' };
    }
    if (!modelConfig.apiKey) {
      return { success: false, error: '模型配置缺少 apiKey' };
    }
    if (!modelConfig.selectedModel) {
      return { success: false, error: '未选择模型' };
    }

    // === 阶段 2: 获取服务端资源 ===
    progressController.handleEvent({ type: 'workflow-stage', stage: 'fetch-template', timestamp: Date.now() });

    clientLog('Calling getAnalysisResources', {
      moduleSlug: moduleConfig?.manifest?.slug,
      outputMode: moduleConfig?.manifest?.outputMode,
    });

    let resources;
    try {
      resources = await getAnalysisResources({
        moduleConfig,
        controlSelections,
      });
      clientLog('getAnalysisResources succeeded', {
        hasSystemPrompt: !!resources?.systemPrompt,
        hasInstructionText: !!resources?.instructionText,
      });
    } catch (resourceError) {
      clientLog('getAnalysisResources failed', {
        error: resourceError instanceof Error ? resourceError.message : String(resourceError),
        stack: resourceError instanceof Error ? resourceError.stack : undefined,
      });
      throw resourceError;
    }

    // === 阶段 3: 构建提示词 ===
    progressController.handleEvent({ type: 'workflow-stage', stage: 'build-prompt', timestamp: Date.now() });

    const { messages: initialMessages } = buildAnalysisMessages({
      input: evaluationInput,
      systemPrompt: resources.systemPrompt,
      instructionText: resources.instructionText,
      mcpToolText: resources.mcpToolText,
      containers: moduleConfig.manifest.containers,
    });

    // === 阶段 4: 调用模型（可能重试） ===
    let attemptMessages = [...initialMessages];
    let finalValidationData: unknown;

    // 客户端直接获取 MCP 工具定义
    const mcpToolDefinitions = getOutputModeMcpTools(moduleConfig.manifest.outputMode);
    clientLog('MCP tools loaded', { toolCount: mcpToolDefinitions.length, tools: mcpToolDefinitions.map(t => t.name) });

    for (let attempt = 0; attempt <= MAX_VALIDATION_REPAIR_ATTEMPTS; attempt += 1) {
      progressController.handleEvent({ type: 'workflow-stage', stage: 'request-model', timestamp: Date.now() });

      // 客户端调用模型 - Key 不会传递给服务端！
      const result = await modelClient.call({
        baseUrl: modelConfig.baseUrl,
        apiKey: modelConfig.apiKey,
        model: modelConfig.selectedModel,
        messages: attemptMessages,
        temperature: 0.7,
        events: progressController.createEventHandlers(),
        mcpToolDefinitions,
      });

      progressController.handleEvent({ type: 'workflow-stage', stage: 'parse-mcp', timestamp: Date.now() });

      const toolCall = result.toolCall;

      if (!toolCall) {
        return { success: false, error: '未检测到有效的 MCP 工具调用' };
      }

      // === 阶段 5: 验证工具调用 ===
      progressController.handleEvent({ type: 'workflow-stage', stage: 'invoke-tool', timestamp: Date.now() });

      const validation = await validateAnalysisOutput({
        outputModeId: moduleConfig.manifest.outputMode,
        toolName: toolCall.name,
        toolParams: toolCall.params,
      });

      if (validation.success) {
        finalValidationData = validation.data;
        break;
      }

      // 验证失败，准备重试
      const canRetry = attempt < MAX_VALIDATION_REPAIR_ATTEMPTS;
      if (!canRetry) {
        const errorSummary = validation.errors?.map(e => `${e.path}: ${e.message}`).join(', ') || '未知错误';
        return { success: false, error: `输出验证失败: ${errorSummary}` };
      }

      // 构建重试消息
      const retryMessage = await buildRetryMessage({
        outputModeId: moduleConfig.manifest.outputMode,
        issues: validation.errors ?? [],
        previousData: toolCall.params,
        attempt,
        maxAttempts: MAX_VALIDATION_REPAIR_ATTEMPTS,
      });

      attemptMessages = [
        ...attemptMessages,
        { role: 'user', content: retryMessage },
      ];
    }

    if (finalValidationData === undefined) {
      return { success: false, error: '输出验证失败：重试后仍未得到合法报告' };
    }

    // === 阶段 6: 生成报告 ===
    progressController.handleEvent({ type: 'workflow-stage', stage: 'normalize', timestamp: Date.now() });

    const { scoringContext } = await buildScoringContext({
      outputModeId: moduleConfig.manifest.outputMode,
      moduleConfig,
      controlSelections,
    });

    const report = buildReport({
      reportId: taskId,
      moduleId: moduleConfig.manifest.slug,
      outputMode: moduleConfig.manifest.outputMode,
      data: finalValidationData,
      modelConfig,
      scoringContext,
    });

    return { success: true, report };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '分析失败';
    return { success: false, error: errorMessage };
  }
}

/**
 * 执行单步分析（Agent 使用）
 *
 * 从 runClientAnalysis 中抽取，支持按步骤调用不同输出模式。
 * - isTerminal = false：中间步骤，调用模型返回上下文字符串
 * - isTerminal = true：终端步骤，完整 MCP + 验证 + 报告流程
 */
export async function runSingleStep(params: {
  outputModeId: string;
  moduleConfig: PageModuleConfig;
  modelConfig: ModelConfig;
  controlSelections: ControlSelections;
  input: EvaluationInput;
  isTerminal: boolean;
}): Promise<AgentStepResult> {
  const { outputModeId, moduleConfig, modelConfig, controlSelections, input: evaluationInput, isTerminal } = params;

  try {
    // 验证模型配置
    if (!modelConfig.baseUrl || !modelConfig.apiKey || !modelConfig.selectedModel) {
      return { success: false, error: '模型配置不完整' };
    }

    // 获取服务端资源（使用指定的 outputModeId）
    const resources = await getStepResources({
      outputModeId,
      moduleConfig,
      controlSelections,
    });

    clientLog('runSingleStep: resources loaded', {
      outputModeId,
      hasSystemPrompt: !!resources?.systemPrompt,
    });

    // 构建消息
    const { messages } = buildAnalysisMessages({
      input: evaluationInput,
      systemPrompt: resources.systemPrompt,
      instructionText: resources.instructionText,
      mcpToolText: resources.mcpToolText,
      containers: moduleConfig.manifest.containers,
    });

    if (isTerminal) {
      // === 终端步骤：完整 MCP + 验证 + 报告流程 ===
      const mcpToolDefinitions = getOutputModeMcpTools(outputModeId);
      clientLog('runSingleStep [terminal]: MCP tools loaded', { toolCount: mcpToolDefinitions.length });

      const result = await modelClient.call({
        baseUrl: modelConfig.baseUrl,
        apiKey: modelConfig.apiKey,
        model: modelConfig.selectedModel,
        messages,
        temperature: 0.7,
        mcpToolDefinitions,
      });

      const toolCall = result.toolCall;
      if (!toolCall) {
        return { success: false, error: '未检测到有效的 MCP 工具调用' };
      }

      // 验证
      const validation = await validateAnalysisOutput({
        outputModeId,
        toolName: toolCall.name,
        toolParams: toolCall.params,
      });

      if (!validation.success) {
        const errorSummary = validation.errors?.map((e) => `${e.path}: ${e.message}`).join(', ') || '未知错误';
        return { success: false, error: `输出验证失败: ${errorSummary}` };
      }

      // 构建报告
      const { scoringContext } = await buildScoringContext({
        outputModeId,
        moduleConfig,
        controlSelections,
      });

      const report = buildReport({
        reportId: `${moduleConfig.manifest.slug}-${Date.now()}`,
        moduleId: moduleConfig.manifest.slug,
        outputMode: outputModeId,
        data: validation.data,
        modelConfig,
        scoringContext,
      });

      return { success: true, report };
    }

    // === 中间步骤：仅获取模型文本响应 ===
    const result = await modelClient.call({
      baseUrl: modelConfig.baseUrl,
      apiKey: modelConfig.apiKey,
      model: modelConfig.selectedModel,
      messages,
      temperature: 0.7,
    });

    clientLog('runSingleStep [intermediate]: model responded', {
      contentLength: result.content?.length ?? 0,
    });

    return { success: true, contextText: result.content };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '步骤执行失败';
    return { success: false, error: errorMessage };
  }
}
