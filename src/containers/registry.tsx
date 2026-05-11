'use client';

import type { ComponentType, ReactNode } from 'react';
import { BaseRegistry } from '@/lib/registry/BaseRegistry';
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
 *
 * 采用延迟初始化模式（与 ControlRegistry / OutputModeRegistry 统一）：
 * - 单例实例在模块加载时创建（无副作用）
 * - 内置容器通过 initialize() 显式注册
 * - 支持 reset() 用于测试隔离
 *
 * 注意：ContainerRenderer 使用 `type` 字段作为标识符（而非 `id`），
 * 内部通过适配层桥接到 BaseRegistry 的 `id` 约定。
 */

/** 内部适配类型：将 ContainerRenderer.type 映射为 BaseRegistry 要求的 id */
type ContainerRegistryEntry = ContainerRenderer & { id: string };

class ContainerRegistryImpl extends BaseRegistry<ContainerRegistryEntry> {
  constructor() {
    super('ContainerRegistry');
  }

  /**
   * 注册容器渲染器
   *
   * 泛型兼容：接受带泛型参数的渲染器，统一存储。
   * ContainerRenderer.type 自动映射为 BaseRegistry 的 id。
   */
  register<TParams, TData = ContainerDataPayload>(
    renderer: ContainerRenderer<TParams, TData>,
  ): void {
    // 将 type 映射为 id，适配 BaseRegistry 的统一约定
    const entry: ContainerRegistryEntry = {
      ...renderer,
      id: renderer.type,
    } as ContainerRegistryEntry;
    super.register(entry);
  }

  /**
   * 获取容器渲染器（按 type 查找）
   */
  getRenderer(type: string): ContainerRenderer | undefined {
    return this.modules.get(type);
  }

  /**
   * 检查容器类型是否已注册
   */
  has(type: string): boolean {
    return this.modules.has(type);
  }

  /**
   * 获取所有已注册的容器类型
   *
   * 兼容旧接口名 getRegisteredTypes()
   */
  getRegisteredTypes(): string[] {
    return this.getIds();
  }
}

/**
 * 全局容器注册表实例
 */
export const containerRegistry = new ContainerRegistryImpl();

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
  const renderer = containerRegistry.getRenderer(config.type);
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
