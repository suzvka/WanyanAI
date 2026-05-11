/**
 * select-control 模块 - 类型定义
 */

// ============================================================================
// 配置类型
// ============================================================================

/**
 * 选项配置
 */
export interface SelectOptionConfig {
  value: string;
  label: string;
  promptText: string;
  enabled: boolean;
  /** 扩展字段 */
  [key: string]: unknown;
}

/**
 * select-control 控件配置（单个控件）
 */
export interface SelectControlItem {
  id: string;
  title: string;
  enabled?: boolean;
  options: SelectOptionConfig[];
}

/**
 * select-control 配置（select 类型的完整配置）
 * 值为控件数组
 */
export type SelectControlConfig = SelectControlItem[];

// ============================================================================
// 渲染器类型
// ============================================================================

/**
 * 渲染器使用的选项类型（简化版）
 */
export interface SelectOption {
  value: string;
  label: string;
  enabled: boolean;
}
