/**
 * Agent Runner — 基于标准 OpenAI tool calling 协议的 Agent 编排器
 *
 * 架构：
 *   Agent LLM (modelClient.callWithTools)  ←→  tools（每个输出模式 = 一个 tool）
 *                                                    │
 *                                                    └── tool.execute() → executeOutputMode()
 *
 * Agent LLM 自主决定调用哪些中间步骤以及调用顺序，
 * 最后必须调用终端步骤产出最终报告。
 *
 * AgentRunner 不直接调用 LLM，所有 LLM 调用走框架层统一入口：
 * - 编排 LLM：modelClient.callWithTools（OpenAI 原生 tool_calling 协议）
 * - 步骤执行：executeOutputMode（框架层统一入口）
 */

import type { AgentRunInput, AgentRunResult, AgentProgressSnapshot } from './types';
import type { AgentPipeline, AgentStep } from '@/types/module';
import type { EvaluationInput } from '@/types/report';
import type { PageModuleConfig } from '@/types/module';
import type { ModelConfig } from '@/types/modelConfig';
import type { ControlSelections } from '@/providers/PageContext';
import type { PersistedAnalysisReport } from '@/types/analysis';
import { renderTextBlocksForModel, renderTextBlockMetadataForModel } from '@/lib/textBlocks';
import { executeOutputMode } from '@/features/analysis-flow/lib/executeOutputMode';
import { modelClient } from '@/services/model-client';
import { getOutputModeMetas } from '@/features/analysis-tasks/getAnalysisResources';

// ---- 日志 ----
const log = (message: string, data?: unknown) => {
  console.log(`[AgentRunner] ${message}`, data !== undefined ? data : '');
};

// ---- 工具注册表中的结果捕获 ----
interface ToolResultCapture {
  terminalReport: PersistedAnalysisReport | null;
  currentStepIndex: number;
}

/**
 * OpenAI 原生 tool calling 的 tool 定义格式
 */
interface OpenAIToolDef {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required: string[];
    };
  };
}

/**
 * Tool 执行函数类型
 */
type ToolExecutor = () => Promise<string>;

/**
 * 为管线中的所有步骤构建 OpenAI 原生 tool 定义和执行器映射
 */
function buildToolDefinitions(
  pipeline: AgentPipeline,
  runInput: {
    moduleConfig: PageModuleConfig;
    modelConfig: ModelConfig;
    controlSelections: ControlSelections;
    input: EvaluationInput;
  },
  capture: ToolResultCapture,
  onProgress: (snapshot: AgentProgressSnapshot) => void,
  descriptions: Map<string, { name: string; description: string }>,
): { tools: OpenAIToolDef[]; executeMap: Map<string, ToolExecutor> } {
  const tools: OpenAIToolDef[] = [];
  const executeMap = new Map<string, ToolExecutor>();
  const stepCount = pipeline.steps.length;

  // ---- 中间步骤 tools ----
  for (const step of pipeline.steps) {
    const meta = descriptions.get(step.outputMode);
    const toolName = step.outputMode;

    tools.push({
      type: 'function',
      function: {
        name: toolName,
        description: buildToolDescription(step, stepCount, false, meta),
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    });

    executeMap.set(toolName, async () => {
      const idx = capture.currentStepIndex;
      capture.currentStepIndex += 1;

      onProgress({
        stepIndex: idx,
        totalSteps: stepCount,
        stepLabel: step.label,
        phase: 'agent-step',
      });

      log(`Running intermediate step: ${step.outputMode} (${step.label})`);

      const result = await executeOutputMode({
        outputModeId: step.outputMode,
        moduleConfig: runInput.moduleConfig,
        modelConfig: runInput.modelConfig,
        controlSelections: runInput.controlSelections,
        input: runInput.input,
        isTerminal: false,
      });

      if (!result.success) {
        const errMsg = `Step "${step.label}" failed: ${result.error}`;
        log(errMsg);
        return `ERROR: ${errMsg}`;
      }

      log(`Step "${step.label}" completed`, {
        contextTextLength: result.contextText?.length ?? 0,
      });

      return result.contextText ?? '(no output)';
    });
  }

  // ---- 终端步骤 tool ----
  const terminalStep = pipeline.terminalStep;
  const terminalMeta = descriptions.get(terminalStep.outputMode);
  const terminalName = terminalStep.outputMode;

  tools.push({
    type: 'function',
    function: {
      name: terminalName,
      description: buildToolDescription(terminalStep, stepCount, true, terminalMeta),
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  });

  executeMap.set(terminalName, async () => {
    onProgress({
      stepIndex: stepCount,
      totalSteps: stepCount,
      stepLabel: terminalStep.label,
      phase: 'agent-final',
    });

    log(`Running terminal step: ${terminalStep.outputMode} (${terminalStep.label})`);

    const result = await executeOutputMode({
      outputModeId: terminalStep.outputMode,
      moduleConfig: runInput.moduleConfig,
      modelConfig: runInput.modelConfig,
      controlSelections: runInput.controlSelections,
      input: runInput.input,
      isTerminal: true,
    });

    if (!result.success || !result.report) {
      const errMsg = `Terminal step "${terminalStep.label}" failed: ${result.error}`;
      log(errMsg);
      return `ERROR: ${errMsg}`;
    }

    capture.terminalReport = result.report;
    log('Terminal step completed', { reportId: result.report.reportId });
    return `Report generated. ID: ${result.report.reportId}`;
  });

  return { tools, executeMap };
}

/**
 * 构建 tool 描述文本（供 agent LLM 决策用）
 */
function buildToolDescription(
  step: AgentStep,
  totalSteps: number,
  isTerminal: boolean,
  meta?: { name: string; description: string },
): string {
  const name = meta?.name ?? step.label;
  const desc = meta?.description ?? `执行「${step.label}」分析`;

  if (isTerminal) {
    return `[FINAL - MUST BE LAST] ${name} — ${desc}`;
  }
  return `[TOOL] ${name} — ${desc} (intermediate step, 共 ${totalSteps} 个可用)`;
}

/**
 * 构建 Agent 系统提示词
 */
function buildAgentSystemPrompt(
  pipeline: AgentPipeline,
  descriptions: Map<string, { name: string; description: string }>,
): string {
  const stepList = pipeline.steps
    .map((s, i) => {
      const meta = descriptions.get(s.outputMode);
      return `${i + 1}. **${meta?.name ?? s.label}** (\`${s.outputMode}\`): ${meta?.description ?? s.label}`;
    })
    .join('\n');

  const terminalMeta = descriptions.get(pipeline.terminalStep.outputMode);

  return `You are an AI analysis coordinator. Your job is to orchestrate a multi-step text analysis pipeline.

## Available Analysis Steps
You may call any of these intermediate steps, in any order, as needed:

${stepList}

## Final Step (MUST BE LAST)
- **${terminalMeta?.name ?? pipeline.terminalStep.label}** (\`${pipeline.terminalStep.outputMode}\`): ${terminalMeta?.description ?? pipeline.terminalStep.label}

## Instructions
1. Analyze the input text by calling one or more intermediate analysis steps
2. You may skip steps that are not relevant and call steps multiple times if needed
3. After you have sufficient analysis, call the final step to produce the report
4. The final step MUST be the last tool you call — do not call any tools after it
5. Do not exceed ${pipeline.maxIterations} intermediate steps`;
}

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
 * 使用原生 fetch() 调用标准 OpenAI tool calling 协议作为 agent 编排引擎：
 * - Agent LLM 自主决定调用哪些中间步骤
 * - 每个步骤的结果自动注入 agent 上下文
 * - 最后必须调用终端步骤产出报告
 * - reasoning_content 等第三方字段通过 JSON 原生序列化无损保留
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

  // 工具结果捕获
  const capture: ToolResultCapture = {
    terminalReport: null,
    currentStepIndex: 0,
  };

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

  // 构建 tool 定义和执行器映射
  const { tools, executeMap } = buildToolDefinitions(
    pipeline,
    { moduleConfig, modelConfig, controlSelections, input: evalInput },
    capture,
    onProgress,
    descriptions,
  );

  // 构建消息
  const systemPrompt = buildAgentSystemPrompt(pipeline, descriptions);
  const userPrompt = buildUserPrompt(evalInput);

  const maxSteps = pipeline.maxIterations + 1; // +1 for terminal step

  // 消息历史（OpenAI 格式），assistant 消息中的 reasoning_content 会自然保留
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages: any[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  try {
    let iteration = 0;

    while (iteration < maxSteps + 2) {
      log(`Agent iteration ${iteration}`);

      // 通过框架层 modelClient 调用编排 LLM（OpenAI 原生 tool_calling 协议）
      const toolCallResult = await modelClient.callWithTools({
        baseUrl: modelConfig.baseUrl,
        apiKey: modelConfig.apiKey,
        model: modelConfig.selectedModel,
        messages,
        tools,
        temperature: 0.3,
        maxIterations: maxSteps,
        currentIteration: iteration,
      });

      // 将 assistant 消息加入历史（reasoning_content 等字段完整保留）
      const assistantMessage = {
        role: 'assistant' as const,
        content: toolCallResult.content,
        tool_calls: toolCallResult.toolCalls,
      };
      messages.push(assistantMessage);

      // 检查是否有 tool calls
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        for (const toolCall of assistantMessage.tool_calls) {
          if (toolCall.type !== 'function') continue;

          const toolName = toolCall.function.name;
          const executor = executeMap.get(toolName);

          if (!executor) {
            log(`Unknown tool called: ${toolName}`);
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: `ERROR: Unknown tool "${toolName}"`,
            });
            continue;
          }

          const toolResult = await executor();

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: toolResult,
          });
        }
      } else {
        // 没有 tool calls，模型直接回复文本，结束循环
        log('Agent finished without tool calls', {
          content: typeof assistantMessage.content === 'string'
            ? assistantMessage.content.slice(0, 200)
            : undefined,
        });
        break;
      }

      iteration += 1;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Agent run failed';
    log('Agent run failed', { error: errorMessage });
    return { success: false, error: errorMessage };
  }

  if (capture.terminalReport) {
    log('Agent completed successfully', { reportId: capture.terminalReport.reportId });
    return { success: true, report: capture.terminalReport };
  }

  log('Agent completed without producing a terminal report');
  return { success: false, error: 'Agent completed without producing a terminal report' };
}
