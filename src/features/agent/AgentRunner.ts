/**
 * Agent 编排器
 *
 * 基于 LangChain 编排层驱动多步骤分析管线：
 * - Agent LLM（ChatOpenAI.bindTools）自主选择中间步骤的顺序和次数
 * - 步骤执行通过现有 executeOutputMode()（零改动）
 * - 中间产物存入 AgentWorkspace，Agent LLM 通过 workspace_list/workspace_read 按需浏览
 * - 终端步骤接受 artifact_ids 参数，仅注入选中的产物
 * - AgentToolRegistry 管理所有工具注册
 *
 * 分层架构：
 *   AgentRunner（入口）→ langchain/agent.ts（编排循环）→ tools.ts（适配器）→ executeOutputMode（步骤执行）
 */

import type { AgentRunInput, AgentRunResult, AgentProgressSnapshot } from './types';
import type { EvaluationInput } from '@/types/report';
import { renderTextBlocksForModel, renderTextBlockMetadataForModel } from '@/lib/textBlocks';
import { modelClient } from '@/services/model-client';
import { ensureBuiltInApiKey } from '@/lib/api-station/builtInConfig';
import { getOutputModeMetas } from '@/features/analysis-tasks/getAnalysisResources';
import { AgentWorkspace } from './workspace';
import { AgentToolRegistry } from './registry';
import {
  createAgentChatModel,
  buildAllStepTools,
  runAgentLoop,
} from './langchain';
import type { TerminalCapture } from './langchain';

const log = (message: string, data?: unknown) => {
  console.log(`[AgentRunner] ${message}`, data !== undefined ? data : '');
};

/**
 * 构建初始用户提示
 */
function buildUserPrompt(input: EvaluationInput): string {
  const parts: string[] = [];
  parts.push(renderTextBlockMetadataForModel(input));
  parts.push(renderTextBlocksForModel(input));
  return parts.join('\n\n');
}

/**
 * 运行 Agent 管线
 *
 * Agent LLM 自主决定中间步骤的调用顺序，中间产物存入 workspace，
 * 终端步骤仅注入选中的产物上下文。
 */
export async function runAgent(
  input: AgentRunInput,
  onProgress: (snapshot: AgentProgressSnapshot) => void,
): Promise<AgentRunResult> {
  const { pipeline, modelConfig, moduleConfig, controlSelections, input: evalInput } = input;

  log('Agent starting', {
    moduleSlug: moduleConfig.manifest.slug,
    pipelineSteps: pipeline.steps.map(s => s.outputMode),
    terminalStep: pipeline.terminalStep.outputMode,
    maxIterations: pipeline.maxIterations,
  });

  // 配置 modelClient（步骤执行仍走 executeOutputMode → modelClient）
  const baseUrl = modelConfig.baseUrl || '/api/v1';
  const apiKey = modelConfig.apiKey || ensureBuiltInApiKey();
  modelClient.configure({ baseUrl, apiKey });

  // 创建工作区（客户端内存沙箱，随函数返回自动 GC）
  const workspace = new AgentWorkspace();

  // 终端报告捕获
  const capture: TerminalCapture = { report: null };

  // 初始进度
  onProgress({
    stepIndex: 0,
    totalSteps: pipeline.steps.length,
    stepLabel: '',
    phase: 'idle',
  });

  // 获取输出模式元数据（名称 + 功能描述，供 Agent LLM 决策使用）
  const allModeIds = [
    ...pipeline.steps.map((s) => s.outputMode),
    pipeline.terminalStep.outputMode,
  ];
  const modeMetas = await getOutputModeMetas(allModeIds);
  const descriptions = new Map(modeMetas.map((m) => [m.id, m]));

  log('Mode descriptions loaded', {
    modes: modeMetas.map((m) => ({ id: m.id, name: m.name, descLen: m.description.length })),
  });

  // 创建 Agent LLM（LangChain ChatOpenAI）
  const chatModel = createAgentChatModel(modelConfig);

  // 构建 ToolContext（含 workspace）
  const toolCtx = {
    moduleConfig,
    modelConfig,
    controlSelections,
    evalInput,
    taskId: input.taskId,
    descriptions,
    workspace,
  };

  // 构建 LangChain Tool 适配器（中间步骤 + 终端步骤 + workspace 工具）
  const { tools, terminalToolName } = buildAllStepTools(
    pipeline.steps,
    pipeline.terminalStep,
    toolCtx,
    capture,
  );

  // 工具注册表（统一管理，便于后续扩展）
  const toolRegistry = new AgentToolRegistry();
  for (const tool of tools) {
    toolRegistry.register({ id: tool.name, tool });
  }

  log('Tools registered', { count: toolRegistry.getIds().length });

  // 构建用户提示词
  const userPrompt = buildUserPrompt(evalInput);

  // 委托 LangChain 编排层执行
  const loopResult = await runAgentLoop({
    chatModel,
    tools: toolRegistry.getAllTools(),
    terminalToolName,
    pipeline,
    descriptions,
    userPrompt,
    onProgress,
  });

  // 检查结果
  if (!loopResult.success) {
    log('Agent run failed', { error: loopResult.error });
    return { success: false, error: loopResult.error ?? 'Agent run failed' };
  }

  if (capture.report) {
    log('Agent completed successfully', { reportId: capture.report.reportId });
    return { success: true, report: capture.report };
  }

  log('Agent completed without producing a terminal report');
  return { success: false, error: 'Agent completed without producing a terminal report' };
}
