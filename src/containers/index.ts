'use client';

import type { ReactNode } from 'react';
import { containerRegistry, renderContainer as _renderContainer } from './registry';
import type { ContainerConfig } from '@/types/module';
import type { ContainerSharedProps } from './registry';
import { getBuiltInContainerManifest } from './manifest';
import TextBlocksContainer from './text-blocks';
import AnalysisControlsContainer from './analysis-controls';
import type { TextBlocksContainerParams } from '@/types/module';
import type { TextBlocksContainerData } from '@/types/container-data';

const builtInContainerManifest = getBuiltInContainerManifest();

function getBuiltInContainerManifestItem(type: string) {
  return builtInContainerManifest.find((item) => item.type === type);
}

/**
 * 注册所有内置容器
 *
 * 此函数由框架在启动时调用（延迟初始化），
 * 不再在 import 时自动执行。
 */
export function registerBuiltinContainers(): void {
  const analysisControlsManifest = getBuiltInContainerManifestItem('analysis-controls');
  const textBlocksManifest = getBuiltInContainerManifestItem('text-blocks');

  // 注册 analysis-controls 容器（无数据类型）
  containerRegistry.register({
    type: analysisControlsManifest?.type || 'analysis-controls',
    component: AnalysisControlsContainer,
  });

  // 注册 text-blocks 容器（带参数类型和数据类型）
  containerRegistry.register<TextBlocksContainerParams, TextBlocksContainerData>({
    type: textBlocksManifest?.type || 'text-blocks',
    component: TextBlocksContainer,
    defaultParams: textBlocksManifest?.defaultParams as Partial<TextBlocksContainerParams> | undefined,
  });

  // 新增容器类型在此注册
  // containerRegistry.register<ImageUploaderParams, ImageUploaderContainerData>({
  //   type: 'image-uploader',
  //   component: ImageUploaderContainer,
  //   defaultParams: {
  //     maxImages: 5,
  //   },
  // });
}

/**
 * 初始化容器注册表（注册所有内置容器）
 *
 * 幂等操作，重复调用不会重复注册。
 * 必须在使用 containerRegistry 之前调用。
 *
 * 客户端容器注册表不通过 server-only 的 loader.ts 统一初始化，
 * 而是通过以下两种方式之一：
 * 1. 显式调用 initializeContainers()
 * 2. renderContainer() 自动初始化守卫（首次渲染时触发）
 */
export function initializeContainers(): void {
  containerRegistry.initialize(registerBuiltinContainers);
}

/**
 * 渲染容器组件（带自动初始化守卫）
 *
 * 首次调用时自动触发容器注册表初始化，
 * 确保即使未显式调用 initializeContainers() 也能正常工作。
 */
export function renderContainer(
  config: ContainerConfig,
  index: number,
  total: number,
  sharedProps?: ContainerSharedProps,
): ReactNode {
  if (!containerRegistry.isInitialized) {
    initializeContainers();
  }
  return _renderContainer(config, index, total, sharedProps);
}

// 导出注册表
export { containerRegistry } from './registry';
