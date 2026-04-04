/**
 * 子维度定义
 * 
 * 支持模块级动态配置，提供默认的6个维度
 */

/** 子维度定义 */
export type SubscoreDefinition = {
  id: string;
  label: string;
};

/** 默认子维度 ID 类型 */
export type DefaultSubscoreId =
  | 'language_expression'
  | 'structural_logic'
  | 'human_depth'
  | 'aesthetic_tension'
  | 'cohesive_integrity'
  | 'empathic_effectiveness';

/** 默认子维度定义（6个维度） */
export const defaultSubscoreDefinitions: SubscoreDefinition[] = [
  { id: 'language_expression', label: '语言表现力' },
  { id: 'structural_logic', label: '结构逻辑' },
  { id: 'human_depth', label: '人文深度' },
  { id: 'aesthetic_tension', label: '审美张力' },
  { id: 'cohesive_integrity', label: '内涵凝聚力' },
  { id: 'empathic_effectiveness', label: '共情效能' },
];

/** 默认子维度 ID 列表 */
export const defaultSubscoreIds: DefaultSubscoreId[] = [
  'language_expression',
  'structural_logic',
  'human_depth',
  'aesthetic_tension',
  'cohesive_integrity',
  'empathic_effectiveness',
];
