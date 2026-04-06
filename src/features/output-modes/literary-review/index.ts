/**
 * 文学作品评审模块 - 统一入口
 *
 * 模块自治架构：
 * - 所有模块代码都在 features/output-modes/literary-review/ 目录下
 * - 服务端逻辑：module.ts（包含 OutputModeModule 定义）
 * - 客户端渲染：renderer.tsx
 * - MCP 工具：mcp-tools.ts
 * - 提示词：prompt.ts
 */

// ============================================================================
// 客户端导出
// ============================================================================

// 导出渲染器（客户端使用）
export { LiteraryReviewRenderer } from './renderer';

// 导出类型
export type {
  LiteraryReviewData,
  LiteraryReviewRawInput,
} from './types';

// ============================================================================
// 服务端导出（通过 module.ts）
// ============================================================================

// 导出提示词（用于调试和预览）
export { LITERARY_REVIEW_PROMPT } from './prompt';

// 导出子维度定义（共享）
export { defaultSubscoreDefinitions, defaultSubscoreIds } from './subscores';
export type { SubscoreDefinition, DefaultSubscoreId } from './subscores';

// 导出验证函数
export { validate as validateLiteraryReview, modelMinimalReportSchema } from './validate';

// 导出乘数计算器
export {
  calculateMultipliers,
  extractAllOptions,
  getSelectedValues,
} from './multiplierCalculator';

// 导出评分计算
export { calcSubscore, deriveGrade, calcTotal, getMaxScore } from './scoring';
