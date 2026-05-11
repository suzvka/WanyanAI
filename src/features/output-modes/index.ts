'use client';

import { createElement, type ComponentType, type ReactNode } from 'react';
import { getOutputModeManifest } from './manifest';

// 导出渲染器类型
export type { RendererProps } from './renderer';
import type { RendererProps } from './renderer';

type OutputModeRendererComponent = ComponentType<RendererProps<unknown>>;

/**
 * 输出模式渲染器映射表
 *
 * 客户端通过此表获取渲染器组件
 */
const RENDERER_MAP: Record<string, OutputModeRendererComponent> = {
  ...Object.fromEntries(
    getOutputModeManifest().map((item) => [item.id, item.renderer]),
  ) as Record<string, OutputModeRendererComponent>,
};

/**
 * 获取输出模式渲染器
 *
 * @param outputModeId - 输出模式 ID
 * @returns 渲染器组件，如果未找到则返回 undefined
 */
export function getOutputModeRenderer(outputModeId: string): OutputModeRendererComponent | undefined {
  return RENDERER_MAP[outputModeId];
}

export function renderOutputMode(
  outputModeId: string,
  props: RendererProps<unknown>,
): ReactNode {
  const renderer = getOutputModeRenderer(outputModeId);
  return renderer ? createElement(renderer, props) : null;
}
