'use client';

/**
 * 渲染器通用 Props
 *
 * 所有输出模式渲染器必须遵循此接口
 */
export type RendererProps<TData = unknown> = {
  data: TData;
  /** 开始新分析（清空所有数据，从新工作区开始） */
  onStartNew?: () => void;
  /** 返回编辑（保持当前数据，回到编辑页面） */
  onBackToEdit?: () => void;
  /** @deprecated 使用 onStartNew 或 onBackToEdit 替代 */
  onReset?: () => void;
};
