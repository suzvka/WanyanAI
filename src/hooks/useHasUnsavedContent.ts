'use client';

import { useMemo } from 'react';
import { isContentSourceEmpty, isTextAnnotationEmpty } from '@/lib/textBlocks';
import type { ContainerDataPayload } from '@/types/container-data';
import type { TextBlocksContainerData } from '@/types/container-data';
import type { TextBlock } from '@/types/report';

/**
 * 检查文本块是否有内容
 */
function hasTextBlockContent(block: TextBlock): boolean {
  // 检查正文
  if (!isContentSourceEmpty(block.content)) {
    return true;
  }

  // 检查批注
  return block.annotations.some((annotation) => !isTextAnnotationEmpty(annotation));
}

/**
 * 检查容器数据是否有内容
 */
function hasContainerDataContent(data: ContainerDataPayload): boolean {
  // 检查 text-blocks 容器
  if ('textBlocks' in data) {
    const textBlocksData = data as TextBlocksContainerData;
    return textBlocksData.textBlocks.some(hasTextBlockContent);
  }

  // 其他容器类型在此扩展
  // if ('images' in data) { ... }

  return false;
}

/**
 * 检查是否有未保存内容的 hook
 *
 * @param containersData - 所有容器的数据
 * @returns 是否有未保存的内容
 */
export function useHasUnsavedContent(containersData: Record<string, ContainerDataPayload>): boolean {
  return useMemo(() => {
    // 遍历所有容器数据，检查是否有内容
    return Object.values(containersData).some(hasContainerDataContent);
  }, [containersData]);
}

export type { ContainerDataPayload };
