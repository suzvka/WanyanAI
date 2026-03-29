import type { ContentSource, TextAnnotation, TextBlock, TextBlockType } from '@/types/report';

export type PendingTextChange = {
  blockId: string;
  annotationId?: string;
  nextText: string;
};

export const textBlockTypeOptions: TextBlockType[] = [
  'actual_text',
  'reference_material',
  'reference_review',
];

export function createTextBlock(number: number, blockType?: string): TextBlock {
  return {
    id: crypto.randomUUID(),
    number,
    blockType: blockType ?? 'actual_text',
    title: `文本${number}`,
    content: null,
    annotations: [],
  };
}

export function createAnnotation(): TextAnnotation {
  return {
    id: crypto.randomUUID(),
    content: null,
  };
}

export function getNextBlockNumber(textBlocks: TextBlock[]) {
  return textBlocks.reduce((max, block) => Math.max(max, block.number), 0) + 1;
}

export function toTextContent(nextText: string): ContentSource | null {
  return nextText === '' ? null : { kind: 'text', text: nextText };
}

export function updateBlock(
  textBlocks: TextBlock[],
  blockId: string,
  updater: (block: TextBlock) => TextBlock,
) {
  return textBlocks.map((block) => (block.id === blockId ? updater(block) : block));
}

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
