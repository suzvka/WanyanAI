/**
 * LangChain Tool 适配器
 *
 * 将每个 outputMode 包装为 LangChain DynamicStructuredTool，
 * 使 Agent LLM 能通过 OpenAI tool calling 协议自主选择步骤。
 *
 * 关键设计约束：
 * - 适配层内部调用现有 executeOutputMode()，不引入 LangChain 类型到输出模式
 * - 中间步骤结果存入 AgentWorkspace，返回摘要（避免上下文膨胀）
 * - 终端步骤接受 artifact_ids 参数，仅注入选中的产物
 * - workspace_list / workspace_read 工具供 Agent LLM 浏览和选取上下文
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { executeOutputMode } from '@/features/analysis-flow/lib/executeOutputMode';
import { AgentWorkspace } from '../workspace';
import type { AgentStep } from '@/types/module';
import type { PageModuleConfig } from '@/types/module';
import type { ModelConfig } from '@/types/modelConfig';
import type { ControlSelections } from '@/providers/PageContext';
import type { EvaluationInput } from '@/types/report';
import type { PersistedAnalysisReport } from '@/types/analysis';

// ---- 类型 ----

/**
 * Tool 执行上下文（闭包捕获，不污染输出模式）
 */
export interface ToolContext {
  moduleConfig: PageModuleConfig;
  modelConfig: ModelConfig;
  controlSelections: ControlSelections;
  evalInput: EvaluationInput;
  taskId: string;
  descriptions: Map<string, { name: string; description: string }>;
  /** Agent 工作区（客户端内存沙箱） */
  workspace: AgentWorkspace;
}

/**
 * 终端步骤执行结果捕获
 */
export interface TerminalCapture {
  report: PersistedAnalysisReport | null;
}

// ---- 工具工厂函数 ----

/**
 * 构建 tool 描述文本（供 Agent LLM 决策用）
 */
function buildToolDescription(
  step: AgentStep,
  isTerminal: boolean,
  meta?: { name: string; description: string },
): string {
  const name = meta?.name ?? step.label;
  const desc = meta?.description ?? `执行「${step.label}」分析`;

  if (isTerminal) {
    return `[FINAL - MUST BE LAST] ${name} — ${desc}。`
      + `参数: artifact_ids (string[], 可选) — 选择要注入的前置分析产物 ID 列表。`
      + `不传时注入全部已完成分析。调用后分析流程结束。`;
  }
  return `[INTERMEDIATE] ${name} — ${desc}。`
    + `执行后结果存入工作区，可使用 workspace_list / workspace_read 浏览。`;
}

/**
 * 将单个 AgentStep 转换为 LangChain DynamicStructuredTool
 *
 * 中间步骤：执行后结果存入 workspace，返回摘要
 * 终端步骤：接受 artifact_ids 参数，注入选中的 workspace 上下文后执行
 */
export function createStepTool(
  step: AgentStep,
  ctx: ToolContext,
  isTerminal: boolean,
  capture: TerminalCapture,
): DynamicStructuredTool {
  const meta = ctx.descriptions.get(step.outputMode);

  if (isTerminal) {
    // 终端步骤：接受 artifact_ids 参数
    return new DynamicStructuredTool({
      name: step.outputMode,
      description: buildToolDescription(step, true, meta),
      schema: z.object({
        artifact_ids: z
          .array(z.string())
          .optional()
          .describe('要注入前置上下文的产物 ID 列表。不传则注入全部。'),
      }),
      func: async (args) => {
        const artifactIds: string[] | undefined = (args as { artifact_ids?: string[] }).artifact_ids;

        // 从 workspace 获取选中的上下文
        const additionalContext = ctx.workspace.getContent(artifactIds);

        const result = await executeOutputMode({
          outputModeId: step.outputMode,
          moduleConfig: ctx.moduleConfig,
          modelConfig: ctx.modelConfig,
          controlSelections: ctx.controlSelections,
          input: ctx.evalInput,
          isTerminal: true,
          taskId: ctx.taskId,
          additionalContext: additionalContext || undefined,
        });

        if (!result.success) {
          return `ERROR: ${result.error}`;
        }

        if (result.report) {
          capture.report = result.report;
          return `Report generated. ID: ${result.report.reportId}`;
        }

        return 'ERROR: Terminal step completed but no report was generated.';
      },
    });
  }

  // 中间步骤：存入 workspace，返回摘要
  return new DynamicStructuredTool({
    name: step.outputMode,
    description: buildToolDescription(step, false, meta),
    schema: z.object({}),
    func: async () => {
      const result = await executeOutputMode({
        outputModeId: step.outputMode,
        moduleConfig: ctx.moduleConfig,
        modelConfig: ctx.modelConfig,
        controlSelections: ctx.controlSelections,
        input: ctx.evalInput,
        isTerminal: false,
      });

      if (!result.success) {
        return `ERROR: ${result.error}`;
      }

      const content = result.contextText ?? '';

      // 存入 workspace
      ctx.workspace.put({
        stepId: step.outputMode,
        outputMode: step.outputMode,
        label: step.label,
        content,
        timestamp: Date.now(),
      });

      // 返回摘要
      const preview = content.length > 150
        ? content.slice(0, 150) + '...'
        : content;
      return `Completed「${step.label}」analysis. ID: ${step.outputMode}. `
        + `Use workspace_read('${step.outputMode}') to view full details.\n`
        + `Preview: ${preview}`;
    },
  });
}

/**
 * 创建 workspace_list 工具
 *
 * 列出 workspace 中所有已完成的分析产物及其摘要。
 */
export function createWorkspaceListTool(workspace: AgentWorkspace): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'workspace_list',
    description:
      'List all completed analysis artifacts in the workspace. '
      + 'Use this to browse available analyses before selecting which to include in the final report.',
    schema: z.object({}),
    func: async () => {
      return workspace.summarize();
    },
  });
}

/**
 * 创建 workspace_read 工具
 *
 * 读取 workspace 中指定产物的完整内容。
 */
export function createWorkspaceReadTool(workspace: AgentWorkspace): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'workspace_read',
    description:
      'Read the full content of a specific analysis artifact from the workspace. '
      + 'Use this to review details before deciding whether to include it in the final report.',
    schema: z.object({
      step_id: z.string().describe('The artifact ID to read (e.g., "checklist")'),
    }),
    func: async (args) => {
      const { step_id } = args as { step_id: string };
      const artifact = workspace.get(step_id);

      if (!artifact) {
        return `ERROR: No artifact found with ID "${step_id}". `
          + `Use workspace_list to see available artifacts.`;
      }

      return `## [${artifact.stepId}] ${artifact.label}\n\n${artifact.content}`;
    },
  });
}

/**
 * 批量构建所有 Agent 工具（中间步骤 + 终端步骤 + workspace 工具）
 *
 * @returns tools 数组和终端工具名
 */
export function buildAllStepTools(
  pipelineSteps: AgentStep[],
  terminalStep: AgentStep,
  ctx: ToolContext,
  capture: TerminalCapture,
): { tools: DynamicStructuredTool[]; terminalToolName: string } {
  const tools: DynamicStructuredTool[] = [];

  // 中间步骤工具
  for (const step of pipelineSteps) {
    tools.push(createStepTool(step, ctx, false, capture));
  }

  // 终端步骤工具
  tools.push(createStepTool(terminalStep, ctx, true, capture));

  // workspace 工具
  tools.push(createWorkspaceListTool(ctx.workspace));
  tools.push(createWorkspaceReadTool(ctx.workspace));

  return { tools, terminalToolName: terminalStep.outputMode };
}
