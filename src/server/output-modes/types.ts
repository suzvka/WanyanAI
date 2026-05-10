/**
 * 输出模式模块 - 服务端接口定义
 *
 * 每个输出模式模块必须实现此接口，保持完全自治。
 */

import type { ReportScoringContext, AnalysisReportMetadata } from '@/types/analysis';
import type { PageModuleConfig } from '@/types/module';
import type { McpToolDefinition } from '@/mcp/types';

export interface ValidationError {
  path: string;
  message: string;
}

export interface ValidationResult {
  success: boolean;
  data?: unknown;
  errors?: ValidationError[];
}

export interface BuildScoringContextParams {
  moduleConfig: PageModuleConfig;
  controlSelections: Record<string, string>;
}

/**
 * 工具调用解析结果。
 *
 * 由 OutputModeModule.resolveToolCall() 返回，将原始工具调用映射为框架语义动作，
 * 使框架无需硬编码业务工具名即可理解调用意图。
 */
export interface ToolCallResolutionResult {
  type: 'data' | 'abort' | 'finalize' | 'unknown';
  data?: Record<string, unknown>;
  reason?: string;
  message?: string;
}

/**
 * 输出模式模块定义。
 *
 * 模块自治：各自声明提示词、工具、验证与评分逻辑，框架仅通过接口调度。
 */
export interface OutputModeModule {
  id: string;

  name: string;

  /**
   * 提示词模板，定义 MCP 工具使用方式、子维度与评级标准。
   * 框架在运行时将其与用户动态指令拼接后发给模型。
   */
  prompt: string;

  mcpToolDefinitions?: McpToolDefinition[];

  validate: (data: unknown) => ValidationResult;

  buildScoringContext: (params: BuildScoringContextParams) => ReportScoringContext;

  /**
   * 拼装多工具收集后的完整报告数据。
   * 仅在模块采用分阶段收集模式时需要实现。
   */
  assemble?: (collectedData: CollectedToolData) => unknown;

  /**
   * 解析工具调用结果。
   *
   * 将模型触发的工具调用映射为框架语义动作，使框架层（StreamingMCPAdapter）
   * 只负责流解析与 handler 执行，而业务语义解释完全下沉到模块。
   * 未覆盖时由注册表提供默认实现，保持向后兼容。
   */
  resolveToolCall?: (
    toolName: string,
    params: Record<string, unknown>
  ) => ToolCallResolutionResult;

  /**
   * 声明本模块依赖的框架级工具名称。
   * 框架在注册时自动注入，避免模块重复声明导致版本不一致。
   */
  getFrameworkToolNames?: () => string[];
}

export interface CollectedToolData {
  [toolName: string]: unknown[];
}

export type OutputModeRegisterFunction = (registry: OutputModeRegistry) => void;

export interface OutputModeRegistry {
  register(module: OutputModeModule): void;
  get(id: string): OutputModeModule | undefined;
  getIds(): string[];
  validate(id: string, data: unknown): ValidationResult;
  buildScoringContext(id: string, params: BuildScoringContextParams): ReportScoringContext;
  assemble(id: string, collectedData: CollectedToolData): { success: boolean; data?: Record<string, unknown>; error?: string };
}
