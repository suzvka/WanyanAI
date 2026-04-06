// 高考作文评分模式

// ============================================================================
// 客户端导出
// ============================================================================

// 导出渲染器（客户端使用）
export { GaokaoEssayRenderer } from './renderer';

// 导出类型
export type {
  GaokaoEssayData,
  GaokaoEssayRawInput,
} from './types';

// ============================================================================
// 服务端导出（通过 module.ts）
// ============================================================================

// 导出提示词（用于调试和预览）
export { GAOKAO_ESSAY_PROMPT } from './prompt';

// 导出子维度定义（共享）
export { gaokaoSubscoreDefinitions, gaokaoSubscoreIds, gaokaoSubscoreWeights } from './subscores';
export type { SubscoreDefinition, GaokaoSubscoreId } from './subscores';

// 导出验证函数
export { validate as validateGaokaoEssay, modelMinimalReportSchema } from './validate';

// 导出乘数计算器
export {
  calculateMultipliers,
  extractAllOptions,
  getSelectedValues,
} from './multiplierCalculator';

// 导出评分计算
export {
  calcSubscore,
  deriveGrade,
  deriveGradeFromScore,
  getDimensionMaxScore,
  calculate,
  scoring,
  GAOKAO_MAX_SCORE,
  GAOKAO_BASE_SCORE,
  GAOKAO_NEUTRAL_MULTIPLIER,
} from './scoring';
