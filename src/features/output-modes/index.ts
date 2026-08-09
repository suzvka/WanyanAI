'use client';

import dynamic from 'next/dynamic';
import { createElement, Suspense, type ComponentType, type ReactNode } from 'react';
import { getOutputModeManifest, getOutputModeMcpTools } from './manifest';

// 导出渲染器类型
export type { RendererProps } from './renderer';

/**
 * 渲染器组件类型。
 * 各渲染器接受的具体 props 类型不同（如 LiteraryReviewRawInput vs GaokaoEssayRawInput），
 * 但运行时这些类型互相兼容，此处使用宽松类型跳过编译期类型检查。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RendererComponent = ComponentType<any>;

/**
 * 懒加载渲染器定义。
 * 每个输出模式的渲染器在此注册其 dynamic import 路径。
 * 新增输出模式只需在此添加一条映射。
 */
const LAZY_RENDERER_LOADERS: Record<string, () => Promise<RendererComponent>> = {
  'literary-review': () =>
    import('./literary-review/renderer').then((m) => m.LiteraryReviewRenderer),
  'gaokao-essay': () =>
    import('./gaokao-essay/renderer').then((m) => m.GaokaoEssayRenderer),
};

/** dynamic() 包装后的组件缓存，避免重复创建 wrapper */
const dynamicCache = new Map<string, RendererComponent>();

function getLazyRenderer(outputModeId: string): RendererComponent | undefined {
  const loader = LAZY_RENDERER_LOADERS[outputModeId];
  if (!loader) return undefined;

  if (!dynamicCache.has(outputModeId)) {
    dynamicCache.set(
      outputModeId,
      dynamic(() => loader().then((Comp) => ({ default: Comp })), { ssr: false }),
    );
  }
  return dynamicCache.get(outputModeId);
}

/**
 * 获取输出模式渲染器（懒加载版本）
 *
 * 返回 dynamic() 包装后的组件，首次渲染时触发代码下载。
 * 历史记录页面用此检查输出模式是否有对应的渲染器。
 */
export function getOutputModeRenderer(outputModeId: string): RendererComponent | undefined {
  return getLazyRenderer(outputModeId);
}

/**
 * 检查输出模式是否有渲染器（是否为终端模式）。
 * 基于 manifest 的 hasRenderer 字段，不会触发任何代码下载。
 */
export function hasOutputModeRenderer(outputModeId: string): boolean {
  const item = getOutputModeManifest().find((m) => m.id === outputModeId);
  return item?.hasRenderer === true;
}

/**
 * 渲染输出模式报告。
 * 使用懒加载 + Suspense，只有在需要展示报告时才下载对应渲染器。
 */
export function renderOutputMode(
  outputModeId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  props: any,
): ReactNode {
  const LazyRenderer = getLazyRenderer(outputModeId);
  if (!LazyRenderer) return null;
  return createElement(
    Suspense,
    // 加载中不显示 fallback——报告区域在父级已有骨架或进度条
    { fallback: null },
    createElement(LazyRenderer, props),
  );
}

// 导出 MCP 工具获取函数
export { getOutputModeMcpTools };
