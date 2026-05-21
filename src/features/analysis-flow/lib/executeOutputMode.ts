/**
 * 输出模式统一执行入口
 *
 * 框架层提供给输出模式的运行时能力：接受输入，调用 LLM（走框架的模型通道），
 * 返回结果。AgentRunner 和传统单步流程都通过此函数执行。
 *
 * - isTerminal = true：完整 MCP 流式链路 → 验证 → 报告
 * - isTerminal = false：纯文本调用 → 返回上下文字符串
 */

import { modelClient } from '@/services/model-client';
import {
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

// ---- 日志 ----
const log = (message: string, data?: unknown) => {
  console.log(`[executeOutputMode] ${message}`, data !== undefined ? data : '');
};

// ---- 类型 ----

/** 统一执行结果 */
export interface ExecuteResult {
  success: boolean;
  /** 终端步骤的报告 */
  report?: PersistedAnalysisReport;
  /** 中间步骤的文本结果（回注到 Agent 上下文） */
  contextText?: string;
  /** 错误信息 */
  error?: string;
}

const MAX_VALIDATION_REPAIR_ATTEMPTS = 1;

/** 验证模型配置 */
function validateModelConfig(modelConfig: ModelConfig): string | null {
  if (!modelConfig.baseUrl) return '模型配置缺少 baseUrl';
  if (!modelConfig.apiKey) return '模型配置缺少 apiKey';
  if (!modelConfig.selectedModel) return '未选择模型';
  return null;
}

/** 构建分析报告 */
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
 * 执行输出模式（终端模式 — 完整 MCP + 验证 + 报告）
 */
async function executeTerminal(params: {
  outputModeId: string;
  moduleConfig: PageModuleConfig;
  modelConfig: ModelConfig;
  controlSelections: ControlSelections;
  input: EvaluationInput;
  taskId: string;
}): Promise<ExecuteResult> {
  const { outputModeId, moduleConfig, modelConfig, controlSelections, input: evalInput, taskId } = params;

  const configError = validateModelConfig(modelConfig);
  if (configError) return { success: false, error: configError };

  // 获取服务端资源
  const resources = await getStepResources({
    outputModeId,
    moduleConfig,
    controlSelections,
  });

  // 构建初始消息
  const { messages: initialMessages } = buildAnalysisMessages({
    input: evalInput,
    systemPrompt: resources.systemPrompt,
    instructionText: resources.instructionText,
    mcpToolText: resources.mcpToolText,
    containers: moduleConfig.manifest.containers,
  });

  // MCP 工具
  const mcpToolDefinitions = getOutputModeMcpTools(outputModeId);
  log('MCP tools loaded', { outputModeId, toolCount: mcpToolDefinitions.length });

  let attemptMessages = [...initialMessages];
  let finalValidationData: unknown;

  for (let attempt = 0; attempt <= MAX_VALIDATION_REPAIR_ATTEMPTS; attempt += 1) {
    const result = await modelClient.call({
      baseUrl: modelConfig.baseUrl,
      apiKey: modelConfig.apiKey,
      model: modelConfig.selectedModel,
      messages: attemptMessages,
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

    if (validation.success) {
      finalValidationData = validation.data;
      break;
    }

    const canRetry = attempt < MAX_VALIDATION_REPAIR_ATTEMPTS;
    if (!canRetry) {
      const errorSummary = validation.errors?.map((e) => `${e.path}: ${e.message}`).join(', ') || '未知错误';
      return { success: false, error: `输出验证失败: ${errorSummary}` };
    }

    const retryMessage = await buildRetryMessage({
      outputModeId,
      issues: validation.errors ?? [],
      previousData: toolCall.params,
      attempt,
      maxAttempts: MAX_VALIDATION_REPAIR_ATTEMPTS,
    });

    attemptMessages = [...attemptMessages, { role: 'user', content: retryMessage }];
  }

  if (finalValidationData === undefined) {
    return { success: false, error: '输出验证失败：重试后仍未得到合法报告' };
  }

  // 评分上下文 + 构建报告
  const { scoringContext } = await buildScoringContext({
    outputModeId,
    moduleConfig,
    controlSelections,
  });

  const report = buildReport({
    reportId: taskId,
    moduleId: moduleConfig.manifest.slug,
    outputMode: outputModeId,
    data: finalValidationData,
    modelConfig,
    scoringContext,
  });

  return { success: true, report };
}

/**
 * 执行输出模式（中间模式 — 纯文本调用）
 */
async function executeIntermediate(params: {
  outputModeId: string;
  moduleConfig: PageModuleConfig;
  modelConfig: ModelConfig;
  controlSelections: ControlSelections;
  input: EvaluationInput;
}): Promise<ExecuteResult> {
  const { outputModeId, moduleConfig, modelConfig, controlSelections, input: evalInput } = params;

  const configError = validateModelConfig(modelConfig);
  if (configError) return { success: false, error: configError };

  const resources = await getStepResources({
    outputModeId,
    moduleConfig,
    controlSelections,
  });

  const { messages } = buildAnalysisMessages({
    input: evalInput,
    systemPrompt: resources.systemPrompt,
    instructionText: resources.instructionText,
    mcpToolText: resources.mcpToolText,
    containers: moduleConfig.manifest.containers,
  });

  const result = await modelClient.call({
    baseUrl: modelConfig.baseUrl,
    apiKey: modelConfig.apiKey,
    model: modelConfig.selectedModel,
    messages,
    temperature: 0.7,
  });

  log('Intermediate step completed', {
    outputModeId,
    contentLength: result.content?.length ?? 0,
  });

  return { success: true, contextText: result.content };
}

/**
 * 执行输出模式 — 框架层统一入口
 *
 * 所有输出模式的执行都通过此函数，AgentRunner 不直接调用 LLM。
 */
export async function executeOutputMode(params: {
  outputModeId: string;
  moduleConfig: PageModuleConfig;
  modelConfig: ModelConfig;
  controlSelections: ControlSelections;
  input: EvaluationInput;
  isTerminal: boolean;
  /** 终端步骤需要 taskId 用于报告 ID */
  taskId?: string;
}): Promise<ExecuteResult> {
  const { outputModeId, isTerminal, taskId, ...rest } = params;

  if (isTerminal) {
    return executeTerminal({
      outputModeId,
      taskId: taskId ?? `${rest.moduleConfig.manifest.slug}-${Date.now()}`,
      ...rest,
    });
  }

  return executeIntermediate({ outputModeId, ...rest });
}
