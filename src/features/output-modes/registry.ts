import type { ComponentType } from 'react';

/**
 * 渲染器通用 Props
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

/**
 * 输出模式定义
 */
export type OutputModeDefinition<TData = unknown> = {
  /** 模式唯一标识 */
  id: string;
  /** 显示名称 */
  name: string;
  /** 格式规定提示词 */
  prompt: string;
  /** 渲染组件 */
  Renderer: ComponentType<RendererProps<TData>>;
  /** 数据验证 */
  validate: (data: unknown) => data is TData;
};

/**
 * 输出模式注册表
 */
class OutputModeRegistry {
  private registry = new Map<string, OutputModeDefinition>();

  /**
   * 注册输出模式
   */
  register<TData>(mode: OutputModeDefinition<TData>): void {
    this.registry.set(mode.id, mode as OutputModeDefinition);
  }

  /**
   * 获取输出模式
   */
  get(id: string): OutputModeDefinition | undefined {
    return this.registry.get(id);
  }

  /**
   * 检查输出模式是否存在
   */
  has(id: string): boolean {
    return this.registry.has(id);
  }

  /**
   * 获取输出模式的提示词
   */
  getPrompt(id: string): string | undefined {
    return this.registry.get(id)?.prompt;
  }

  /**
   * 获取所有已注册的模式 ID
   */
  getRegisteredIds(): string[] {
    return Array.from(this.registry.keys());
  }
}

/**
 * 全局输出模式注册表实例
 */
export const outputModeRegistry = new OutputModeRegistry();

/**
 * 获取已注册的输出模式 ID 列表
 */
export function getRegisteredOutputModes(): string[] {
  return outputModeRegistry.getRegisteredIds();
}

/**
 * 获取输出模式的提示词
 */
export function getOutputModePrompt(id: string): string | undefined {
  return outputModeRegistry.getPrompt(id);
}

/**
 * 获取输出模式定义
 */
export function getOutputMode(id: string): OutputModeDefinition | undefined {
  return outputModeRegistry.get(id);
}
