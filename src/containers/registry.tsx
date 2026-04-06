'use client';

import type { ComponentType, ReactNode } from 'react';
import type { ContainerConfig } from '@/types/module';
import type { ContainerDataPayload } from '@/types/container-data';

/**
 * 容器渲染器定义
 *
 * @template TParams - 容器参数类型
 * @template TData - 容器数据类型
 */
export type ContainerRenderer<
  TParams = Record<string, unknown>,
  TData = ContainerDataPayload,
> = {
  /** 容器类型标识 */
  type: string;
  /** 渲染组件 */
  component: ComponentType<ContainerComponentProps<TParams, TData>>;
  /** 参数验证 */
  validateParams?: (params: unknown) => params is TParams;
  /** 默认参数 */
  defaultParams?: Partial<TParams>;
};

/**
 * 容器共享 Props（泛型化）
 *
 * 所有容器都会接收这些 props，数据类型由泛型参数指定。
 *
 * @template TData - 容器数据类型
 *
 * @example
 * // text-blocks 容器
 * type TextBlocksSharedProps = ContainerSharedProps<TextBlocksContainerData>;
 * // 等价于 { data?: TextBlocksContainerData; onDataChange?: (data: TextBlocksContainerData) => void }
 */
export type ContainerSharedProps<TData = ContainerDataPayload> = {
  /** 容器数据（由各容器自行解释类型） */
  data?: TData;
  /** 数据变化回调 */
  onDataChange?: (data: TData) => void;
};

/**
 * 容器组件 Props（泛型化）
 *
 * @template TParams - 容器参数类型
 * @template TData - 容器数据类型
 */
export type ContainerComponentProps<
  TParams = Record<string, unknown>,
  TData = ContainerDataPayload,
> = {
  /** 容器配置 */
  config: ContainerConfig & { params: TParams };
  /** 容器在列表中的索引 */
  index: number;
  /** 是否是最后一个容器 */
  isLast: boolean;
} & ContainerSharedProps<TData>;

/**
 * 容器注册表
 */
class ContainerRegistry {
  private registry = new Map<string, ContainerRenderer>();

  /**
   * 注册容器渲染器
   */
  register<TParams, TData = ContainerDataPayload>(
    renderer: ContainerRenderer<TParams, TData>,
  ): void {
    this.registry.set(renderer.type, renderer as ContainerRenderer);
  }

  /**
   * 获取容器渲染器
   */
  get(type: string): ContainerRenderer | undefined {
    return this.registry.get(type);
  }

  /**
   * 检查容器类型是否已注册
   */
  has(type: string): boolean {
    return this.registry.has(type);
  }

  /**
   * 获取所有已注册的容器类型
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.registry.keys());
  }
}

/**
 * 全局容器注册表实例
 */
export const containerRegistry = new ContainerRegistry();

/**
 * 渲染容器组件
 *
 * @param config - 容器配置
 * @param index - 容器在列表中的索引
 * @param total - 容器总数
 * @param sharedProps - 共享 props（数据通道）
 */
export function renderContainer(
  config: ContainerConfig,
  index: number,
  total: number,
  sharedProps?: ContainerSharedProps,
): ReactNode {
  const renderer = containerRegistry.get(config.type);
  if (!renderer) {
    return null;
  }

  const mergedParams: Record<string, unknown> = {
    ...renderer.defaultParams,
    ...config.params,
  };

  const Component = renderer.component;
  return (
    <Component
      key={`${config.type}-${config.params ? JSON.stringify(config.params) : index}`}
      config={{ ...config, params: mergedParams }}
      index={index}
      isLast={index === total - 1}
      {...sharedProps}
    />
  );
}
