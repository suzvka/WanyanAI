import type { ContentSource, TextAnnotation, TextBlock } from '@/types/report';

export type PendingTextChange = {
  blockId: string;
  annotationId?: string;
  nextText: string;
};

/**
 * 创建文本块
 */
export function createTextBlock(): TextBlock {
  return {
    id: crypto.randomUUID(),
    title: '',
    content: null,
    annotations: [],
  };
}

/**
 * 创建批注
 */
export function createAnnotation(): TextAnnotation {
  return {
    id: crypto.randomUUID(),
    content: null,
  };
}

/**
 * 将文本转换为 ContentSource
 */
export function toTextContent(nextText: string): ContentSource | null {
  return nextText === '' ? null : { kind: 'text', text: nextText };
}

/**
 * 更新指定文本块
 */
export function updateBlock(
  textBlocks: TextBlock[],
  blockId: string,
  updater: (block: TextBlock) => TextBlock,
) {
  return textBlocks.map((block) => (block.id === blockId ? updater(block) : block));
}

/**
 * 构建更新后的文本块数组
 */
export function buildNextBlocks(
  textBlocks: TextBlock[],
  blockId: string,
  nextContent: ContentSource | null,
  annotationId?: string,
) {
  return textBlocks.map((block) => {
    if (block.id !== blockId) {
      return block;
    }

    if (!annotationId) {
      return {
        ...block,
        content: nextContent,
      };
    }

    return {
      ...block,
      annotations: block.annotations.map((annotation) =>
        annotation.id === annotationId
          ? {
              ...annotation,
              content: nextContent,
            }
          : annotation,
      ),
    };
  });
}

/**
 * 查找当前内容
 */
export function findCurrentContent(textBlocks: TextBlock[], blockId: string, annotationId?: string) {
  const block = textBlocks.find((item) => item.id === blockId);
  if (!block) {
    return null;
  }

  if (!annotationId) {
    return block.content;
  }

  return block.annotations.find((annotation) => annotation.id === annotationId)?.content ?? null;
}
