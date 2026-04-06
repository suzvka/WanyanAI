'use client';

// 导出渲染器类型
export type { RendererProps } from './renderer';

// 导出所有内置输出模式的渲染器
import { LiteraryReviewRenderer } from './literary-review/renderer';
import { GaokaoEssayRenderer } from './gaokao-essay/renderer';

/**
 * 输出模式渲染器映射表
 *
 * 客户端通过此表获取渲染器组件
 */
const RENDERER_MAP: Record<string, React.ComponentType<any>> = {
  'literary-review': LiteraryReviewRenderer,
  'gaokao-essay': GaokaoEssayRenderer,
};

/**
 * 获取输出模式渲染器
 *
 * @param outputModeId - 输出模式 ID
 * @returns 渲染器组件，如果未找到则返回 undefined
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getOutputModeRenderer(outputModeId: string): React.ComponentType<any> | undefined {
  return RENDERER_MAP[outputModeId];
}
