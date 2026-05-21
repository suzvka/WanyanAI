/**
 * Agent 系统类型定义
 *
 * Agent 编排基于标准 OpenAI tool calling 协议实现，
 * 每个输出模式封装为 OpenAI function tool，由 agent LLM 自主决定调用顺序。
 *
 * 步骤执行统一走框架层 executeOutputMode()（ExecuteResult），
 * 不再暴露独立的 AgentStepResult 类型。
 */

import type { EvaluationInput } from '@/types/report';
import type { PageModuleConfig, AgentStep, AgentPipeline } from '@/types/module';
import type { ModelConfig } from '@/types/modelConfig';
import type { ControlSelections } from '@/providers/PageContext';
import type { PersistedAnalysisReport } from '@/types/analysis';

/**
 * Agent 运行进度快照
 */
export interface AgentProgressSnapshot {
  /** 当前步骤索引（0-based） */
  stepIndex: number;
  /** 中间步骤总数 */
  totalSteps: number;
  /** 当前步骤标签 */
  stepLabel: string;
  /** 当前阶段 */
  phase: 'agent-step' | 'agent-final' | 'idle';
}

/**
 * Agent 运行输入
 */
export interface AgentRunInput {
  taskId: string;
  moduleConfig: PageModuleConfig;
  modelConfig: ModelConfig;
  controlSelections: ControlSelections;
  input: EvaluationInput;
  pipeline: AgentPipeline;
}

/**
 * Agent 运行结果
 */
export interface AgentRunResult {
  success: boolean;
  report?: PersistedAnalysisReport;
  error?: string;
}

// Re-export for convenience
export type { AgentStep, AgentPipeline };
