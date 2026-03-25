import { prepareEvaluationSubmission } from '@/lib/evaluationSubmission';
import { EvaluationInput, SerializableEvaluationInput, TextBlock, TextBlockAttachment, TextBlockContentUnit, TextBlockType } from '@/types/report';

export const MAX_BLOCK_CONTENT_LENGTH = 100000;

const textBlockTypeLabels: Record<TextBlockType, string> = {
  actual_text: '正文',
  reference_material: '参考材料',
  reference_review: '参考评价',
};

export function getTextBlockTypeLabel(blockType: TextBlockType): string {
  return textBlockTypeLabels[blockType];
}

function getDefaultBlockTitle(block: Pick<TextBlock, 'number'>) {
  return `文本${block.number}`;
}

function renderFileContent(file: Pick<TextBlockAttachment, 'storedName' | 'content'>) {
  return `[${file.storedName}]\n${file.content}`;
}

function getUnitDisplayText(unit: Pick<TextBlockContentUnit, 'draftText' | 'file'>): string {
  const draftText = unit.draftText.trim();
  if (draftText) {
    return draftText;
  }

  if (unit.file) {
    return renderFileContent(unit.file);
  }

  return '（空）';
}

function getUnitModelText(unit: Pick<TextBlockContentUnit, 'draftText' | 'file'>): string | null {
  const draftText = unit.draftText.trim();
  if (draftText) {
    return unit.draftText;
  }

  if (unit.file) {
    return renderFileContent(unit.file);
  }

  return null;
}

function serializeSingleTextBlock(block: TextBlock): string {
  const title = block.title.trim() || getDefaultBlockTitle(block);
  const lines = [
    `## ${title}`,
    `- 编号：${block.number}`,
    `- 类型：${getTextBlockTypeLabel(block.blockType)}`,
    '',
    getUnitDisplayText(block),
  ];

  if (block.localSupplements.length > 0) {
    lines.push('', '### 局部说明');

    block.localSupplements.forEach((supplement, index) => {
      lines.push(`#### 说明 ${index + 1}`, '', getUnitDisplayText(supplement));
    });
  }

  return lines.join('\n');
}

function getTopLevelBlocks(input: Pick<EvaluationInput, 'textBlocks' | 'globalSupplementBlocks'>): TextBlock[] {
  return [...input.textBlocks, ...input.globalSupplementBlocks];
}

function getAllContentUnits(input: Pick<EvaluationInput, 'textBlocks' | 'globalSupplementBlocks'>) {
  return getTopLevelBlocks(input).flatMap((block) => [block, ...block.localSupplements]);
}

export function hasReferenceTextBlock(input: Pick<EvaluationInput, 'textBlocks' | 'globalSupplementBlocks'>): boolean {
  return getTopLevelBlocks(input).some((block) => block.blockType === 'reference_material');
}

export function getTopLevelTextBlockCount(input: Pick<EvaluationInput, 'textBlocks' | 'globalSupplementBlocks'>): number {
  return getTopLevelBlocks(input).length;
}

export function getTopLevelTextBlockTypes(input: Pick<EvaluationInput, 'textBlocks' | 'globalSupplementBlocks'>): TextBlockType[] {
  return [...new Set(getTopLevelBlocks(input).map((block) => block.blockType))];
}

export function serializeTextBlocks(input: Pick<EvaluationInput, 'textBlocks' | 'globalSupplementBlocks'>): string {
  const sections: string[] = [];

  if (input.textBlocks.length > 0) {
    sections.push('## 主文本块');
    sections.push(input.textBlocks.map((block) => serializeSingleTextBlock(block)).join('\n\n'));
  }

  if (input.globalSupplementBlocks.length > 0) {
    sections.push('## 整体说明块');
    sections.push(input.globalSupplementBlocks.map((block) => serializeSingleTextBlock(block)).join('\n\n'));
  }

  if (sections.length === 0) {
    return '未提供文本块';
  }

  return sections.join('\n\n');
}

export function renderTextBlocksForModel(input: Pick<EvaluationInput, 'textBlocks' | 'globalSupplementBlocks'>): string {
  const segments = getTopLevelBlocks(input).flatMap((block) => {
    const blockSegments = [getUnitModelText(block)];
    const supplementSegments = block.localSupplements.map((supplement) => getUnitModelText(supplement));
    return [...blockSegments, ...supplementSegments].filter((value): value is string => Boolean(value));
  });

  return segments.join('\n\n');
}

export function summarizeTextBlocks(input: Pick<EvaluationInput, 'textBlocks' | 'globalSupplementBlocks'>): string {
  const topLevelBlocks = getTopLevelBlocks(input);

  if (topLevelBlocks.length === 0) {
    return '未提供文本块';
  }

  return topLevelBlocks
    .map((block) => `${block.number}. ${getTextBlockTypeLabel(block.blockType)} / ${block.title.trim() || getDefaultBlockTitle(block)}`)
    .join('；');
}

export function getTextBlockPlainTextLength(input: Pick<EvaluationInput, 'textBlocks' | 'globalSupplementBlocks'>): number {
  return getAllContentUnits(input).reduce((total, unit) => total + getUnitRawTextLength(unit), 0);
}

export function getUnitRawTextLength(unit: Pick<TextBlockContentUnit, 'draftText' | 'file'>): number {
  if (unit.file) {
    return unit.file.content.length;
  }

  return unit.draftText.length;
}

export function getRenderedTextBlockLength(input: Pick<EvaluationInput, 'textBlocks' | 'globalSupplementBlocks'>): number {
  return renderTextBlocksForModel(input).length;
}

export function toSerializableEvaluationInput(input: EvaluationInput): SerializableEvaluationInput {
  return prepareEvaluationSubmission(input).submissionData;
}
