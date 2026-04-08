/**
 * 输出模式模块 - 服务端接口定义
 *
 * 每个输出模式模块必须实现此接口，实现完全自治
 */

import type { ReportScoringContext, AnalysisReportMetadata } from '@/types/analysis';
import type { PageModuleConfig } from '@/types/module';
import type { McpToolDefinition } from '@/mcp/types';

// ============================================================================
// 验证结果
// ============================================================================

/** 验证错误项 */
export interface ValidationError {
  path: string;
  message: string;
}

/** 验证结果 */
export interface ValidationResult {
  success: boolean;
  data?: unknown;
  errors?: ValidationError[];
}

// ============================================================================
// 处理器输入/输出
// ============================================================================

/** 处理器输入参数 */
export interface ProcessInput {
  /** 报告 ID */
  reportId: string;
  /** 创建时间 */
  createdAt: string;
  /** 模型返回的原始 JSON 数据 */
  rawJson: unknown;
  /** 报告元数据 */
  metadata: AnalysisReportMetadata;
  /** 评分上下文 */
  scoringContext: ReportScoringContext;
}

/** 处理后的子维度数据 */
export interface ProcessedSubscore {
  id: string;
  label: string;
  grade: string;
  score: number;
  maxScore: number;
  rationale: string;
}

/** 处理后的仪表盘数据 */
export interface ProcessedDashboard {
  totalScore: number;
  maxScore: number;
  grade: string;
  subscores: ProcessedSubscore[];
}

/** 处理后的段落 */
export interface ProcessedSection {
  sectionTitle?: string;
  paragraphTitle?: string;
  id?: string;
  title?: string;
  body: string;
  groupId?: string;
  groupTitle?: string;
}

/** 处理后的元数据 */
export interface ProcessedMeta {
  frameworkVersion: string;
  scoringPolicyVersion: string;
  conclusionPolicyVersion: string;
  provider: string;
  model: string;
}

/** 处理后的诊断信息 */
export interface ProcessedDiagnostics {
  normalizationMode: 'paragraph-sections';
  sectionCount: number;
}

/**
 * 处理后的报告数据（渲染器输入）
 *
 * 这是所有输出模式必须返回的通用结构
 */
export interface ProcessedReportData {
  /** Schema 版本 */
  schemaVersion: string;
  /** 报告 ID */
  reportId: string;
  /** 报告版本 */
  reportVersion: string;
  /** 生成时间 */
  generatedAt: string;
  /** 摘要 */
  summary: {
    title?: string;
    overview: string;
  };
  /** 仪表盘 */
  dashboard: ProcessedDashboard;
  /** 结论 */
  conclusion: {
    rationale: string;
  };
  /** 元数据 */
  meta: ProcessedMeta;
  /** 段落列表 */
  sections: ProcessedSection[];
  /** 诊断信息 */
  diagnostics: ProcessedDiagnostics;
}

// ============================================================================
// 评分上下文构建
// ============================================================================

/** 评分上下文构建参数 */
export interface BuildScoringContextParams {
  moduleConfig: PageModuleConfig;
  controlSelections: Record<string, string>;
}

// ============================================================================
// 模块定义
// ============================================================================

/**
 * 输出模式模块定义
 *
 * 每个输出模式模块必须实现此接口，包含：
 * - 提示词模板
 * - MCP 工具定义（支持多工具分阶段收集）
 * - 数据验证
 * - 数据处理
 * - 评分上下文构建
 */
export interface OutputModeModule {
  /** 模块唯一标识（如 'literary-review', 'gaokao-essay'） */
  id: string;

  /** 显示名称 */
  name: string;

  /**
   * 提示词模板
   *
   * 定义 MCP 工具使用方式、子维度 ID、评级标准等
   */
  prompt: string;

  /**
   * MCP 工具定义（MCP 格式，用于提示词编译和客户端执行）
   *
   * 推荐使用此格式，包含 name、description、parameters、inputSchema、handler
   */
  mcpToolDefinitions?: McpToolDefinition[];

  /**
   * 数据验证函数
   *
   * 验证模型返回的原始数据是否符合模块要求
   */
  validate: (data: unknown) => ValidationResult;

  /**
   * 数据处理函数
   *
   * 完整流程：
   * 1. 验证原始数据
   * 2. 标准化为模块报告数据
   * 3. 计算评分
   */
  process: (input: ProcessInput) => unknown;

  /**
   * 构建评分上下文
   *
   * 根据模块配置和控制选项构建评分乘数
   */
  buildScoringContext: (params: BuildScoringContextParams) => ReportScoringContext;

  /**
   * 拼装报告数据（多工具模式）
   *
   * 从多个工具调用结果中拼装完整的报告数据
   */
  assemble?: (collectedData: CollectedToolData) => unknown;
}

/**
 * 收集的工具数据
 *
 * 多工具分阶段收集模式下的数据结构
 */
export interface CollectedToolData {
  /** 工具调用名称 -> 数据列表 */
  [toolName: string]: unknown[];
}

// ============================================================================
// 模块注册接口
// ============================================================================

/**
 * 模块注册函数类型
 *
 * 每个模块必须导出此类型的 register 函数
 */
export type OutputModeRegisterFunction = (registry: OutputModeRegistry) => void;

/**
 * 输出模式注册表接口
 */
export interface OutputModeRegistry {
  register(module: OutputModeModule): void;
  get(id: string): OutputModeModule | undefined;
  getIds(): string[];
  validate(id: string, data: unknown): ValidationResult;
  buildScoringContext(id: string, params: BuildScoringContextParams): ReportScoringContext;
  assemble(id: string, collectedData: CollectedToolData): { success: boolean; data?: Record<string, unknown>; error?: string };
}
