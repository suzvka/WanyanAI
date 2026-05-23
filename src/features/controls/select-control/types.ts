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
  /** 选项值（可选，默认为 label） */
  value?: string;
  label: string;
  promptText?: string;
  /** 是否启用（可选，默认为 true） */
  enabled?: boolean;
  /** 是否默认选中 */
  defaultSelected?: boolean;
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
  value?: string;
  label: string;
  enabled?: boolean;
  defaultSelected?: boolean;
}
