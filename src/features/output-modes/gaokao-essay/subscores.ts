/**
 * 高考作文评分子维度定义
 * 
 * 基于《高考作文评分标准》设定6个维度
 */

/** 子维度定义 */
export type SubscoreDefinition = {
  id: string;
  label: string;
};

/** 高考作文子维度 ID 类型 */
export type GaokaoSubscoreId =
  | 'theme_positioning'
  | 'content_richness'
  | 'structure_logic'
  | 'language_expression'
  | 'development_depth'
  | 'development_innovation';

/** 高考作文子维度定义（6个维度） */
export const gaokaoSubscoreDefinitions: SubscoreDefinition[] = [
  { id: 'theme_positioning', label: '审题立意' },
  { id: 'content_richness', label: '内容充实' },
  { id: 'structure_logic', label: '结构逻辑' },
  { id: 'language_expression', label: '语言表达' },
  { id: 'development_depth', label: '发展等级·深刻' },
  { id: 'development_innovation', label: '发展等级·创新' },
];

/** 高考作文子维度 ID 列表 */
export const gaokaoSubscoreIds: GaokaoSubscoreId[] = [
  'theme_positioning',
  'content_richness',
  'structure_logic',
  'language_expression',
  'development_depth',
  'development_innovation',
];

/** 高考作文维度权重（用于评分计算） */
export const gaokaoSubscoreWeights: Record<GaokaoSubscoreId, number> = {
  theme_positioning: 0.30,      // 审题立意：30%
  content_richness: 0.20,       // 内容充实：20%
  structure_logic: 0.15,        // 结构逻辑：15%
  language_expression: 0.15,    // 语言表达：15%
  development_depth: 0.10,      // 发展等级·深刻：10%
  development_innovation: 0.10, // 发展等级·创新：10%
};
