/**
 * Agent 系统类型定义
 *
 * Agent 编排基于标准 OpenAI tool calling 协议实现，
 * 每个输出模式封装为 OpenAI function tool，由 agent LLM 自主决定调用顺序。
 */

import type { EvaluationInput } from '@/types/report';
import type { PageModuleConfig, AgentStep, AgentPipeline } from '@/types/module';
import type { ModelConfig } from '@/types/modelConfig';
import type { ControlSelections } from '@/providers/PageContext';
import type { PersistedAnalysisReport } from '@/types/analysis';

/**
 * 单步分析输出结果
 */
export interface AgentStepResult {
  success: boolean;
  /** 终端步骤的报告 */
  report?: PersistedAnalysisReport;
  /** 中间步骤的文本结果（回注到 agent 上下文） */
  contextText?: string;
  /** 错误信息 */
  error?: string;
}

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
