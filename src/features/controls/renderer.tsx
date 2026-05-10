/**
 * 控件渲染器映射
 *
 * 根据控件类型返回对应的渲染组件
 */
'use client';

import type { ControlDefinition } from '@/features/controls/types';
import { SelectControlRenderer } from '@/features/controls/select-control/renderer';
import { MultiSelectRenderer } from '@/features/controls/multi-select/renderer';

type ControlRendererProps = {
  definition: ControlDefinition;
  value: string;
  onChange: (controlId: string, value: string) => void;
  disabled?: boolean;
};

type ControlRenderer = React.ComponentType<ControlRendererProps>;

const RENDERER_MAP: Record<string, ControlRenderer> = {
  'select': SelectControlRenderer,
  'multi-select': MultiSelectRenderer,
};

/**
 * 根据控件定义获取对应的渲染器
 */
export function getControlRenderer(type: string): ControlRenderer | null {
  return RENDERER_MAP[type] ?? null;
}

/**
 * 获取所有已注册的控件类型
 */
export function getRegisteredControlTypes(): string[] {
  return Object.keys(RENDERER_MAP);
}

/**
 * 动态渲染控件
 */
export function renderControl(
  definition: ControlDefinition,
  value: string,
  onChange: (controlId: string, value: string) => void,
  disabled?: boolean,
): React.ReactNode {
  const Renderer = getControlRenderer(definition.type);
  if (!Renderer) {
    return (
      <div className="text-sm text-muted-foreground">
        未知的控件类型: {definition.type}
      </div>
    );
  }

  return (
    <Renderer
      definition={definition}
      value={value}
      onChange={onChange}
      disabled={disabled}
    />
  );
}
