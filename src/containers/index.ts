'use client';

import { containerRegistry } from './registry';
import TextBlocksContainer from './text-blocks';
import AnalysisControlsContainer from './analysis-controls';
import type { TextBlocksContainerParams } from '@/types/module';
import type { TextBlocksContainerData } from '@/types/container-data';

/**
 * 注册所有内置容器
 */
export function registerBuiltInContainers(): void {
  // 注册 analysis-controls 容器（无数据类型）
  containerRegistry.register({
    type: 'analysis-controls',
    component: AnalysisControlsContainer,
  });

  // 注册 text-blocks 容器（带参数类型和数据类型）
  containerRegistry.register<TextBlocksContainerParams, TextBlocksContainerData>({
    type: 'text-blocks',
    component: TextBlocksContainer,
    defaultParams: {
      defaultExpanded: false,
      initialBlockCount: 0,
    },
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

// 自动注册
registerBuiltInContainers();

// 导出注册表和渲染函数
export { containerRegistry, renderContainer } from './registry';

// 导出容器类型
export type { ContainerRenderer, ContainerComponentProps, ContainerSharedProps } from './registry';
