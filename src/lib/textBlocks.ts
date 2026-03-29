import { prepareEvaluationSubmission } from '@/lib/evaluationSubmission';
import {
  ContentSource,
  EvaluationInput,
  SerializableEvaluationInput,
  SerializableTextBlockContent,
  TextAnnotation,
  TextBlock,
  TextBlockAttachment,
  TextBlockType,
} from '@/types/report';

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

function getPromptContentReferenceName(source: ContentSource, fallbackFileName: string) {
  return source.kind === 'file' ? source.file.storedName : fallbackFileName;
}

function renderPromptContentSegment(fileName: string, content: string) {
  return `${fileName}\n${content}`;
}

function readContentSourceAsPromptContent(source: ContentSource | null | undefined): string | null {
  if (!source || isContentSourceEmpty(source)) {
    return null;
  }

  if (source.kind === 'file') {
    return source.file.content;
  }

  return source.text;
}

function getPromptMetadataContent(
  content: SerializableTextBlockContent | null,
  fallbackFileName: string,
): { kind: 'text' | 'file'; fileName: string } | null {
  if (!content) {
    return null;
  }

  if (content.kind === 'file') {
    return {
      kind: 'file',
      fileName: content.fileName,
    };
  }

  return {
    kind: 'text',
    fileName: fallbackFileName,
  };
}

export function isContentSourceEmpty(source: ContentSource | null | undefined): boolean {
  if (!source) {
    return true;
  }

  if (source.kind === 'text') {
    return source.text.trim().length === 0;
  }

  return source.file.content.trim().length === 0;
}

export function readContentSourceAsPlainText(source: ContentSource | null | undefined): string | null {
  if (!source || isContentSourceEmpty(source)) {
    return null;
  }

  if (source.kind === 'text') {
    return source.text;
  }

  return renderFileContent(source.file);
}

export function getContentSourceDisplayText(source: ContentSource | null | undefined): string {
  return readContentSourceAsPlainText(source) ?? '（空）';
}

export function getContentSourceRawLength(source: ContentSource | null | undefined): number {
  if (!source) {
    return 0;
  }

  if (source.kind === 'text') {
    return source.text.length;
  }

  return source.file.content.length;
}

export function isTextAnnotationEmpty(annotation: Pick<TextAnnotation, 'content'>): boolean {
  return isContentSourceEmpty(annotation.content);
}

export function hasRenderableTextBlockContent(block: Pick<TextBlock, 'content'>): boolean {
  return !isContentSourceEmpty(block.content);
}

export function getRenderableTextBlocks(input: Pick<EvaluationInput, 'textBlocks'>): TextBlock[] {
  return input.textBlocks.filter((block) => hasRenderableTextBlockContent(block));
}

function serializeSingleTextBlock(block: TextBlock): string {
  const title = block.title.trim() || getDefaultBlockTitle(block);
  const lines = [
    `## ${title}`,
    `- 编号：${block.number}`,
    `- 类型：${getTextBlockTypeLabel(block.blockType)}`,
    '',
    getContentSourceDisplayText(block.content),
  ];

  const renderableAnnotations = block.annotations.filter((annotation) => !isTextAnnotationEmpty(annotation));
  if (renderableAnnotations.length > 0) {
    lines.push('', '### 批注');

    renderableAnnotations.forEach((annotation, index) => {
      lines.push(`#### 批注 ${index + 1}`, '', getContentSourceDisplayText(annotation.content));
    });
  }

  return lines.join('\n');
}

export function hasReferenceTextBlock(input: Pick<EvaluationInput, 'textBlocks'>): boolean {
  return input.textBlocks.some((block) => block.blockType === 'reference_material');
}

export function getTopLevelTextBlockCount(input: Pick<EvaluationInput, 'textBlocks'>): number {
  return input.textBlocks.length;
}

export function getTopLevelTextBlockTypes(input: Pick<EvaluationInput, 'textBlocks'>): TextBlockType[] {
  return [...new Set(input.textBlocks.map((block) => block.blockType))];
}

export function serializeTextBlocks(input: Pick<EvaluationInput, 'textBlocks'>): string {
  const renderableBlocks = getRenderableTextBlocks(input);

  if (renderableBlocks.length === 0) {
    return '未提供文本块';
  }

  return renderableBlocks.map((block) => serializeSingleTextBlock(block)).join('\n\n');
}

export function renderTextBlocksForModel(input: Pick<EvaluationInput, 'textBlocks'>): string {
  const segments = getRenderableTextBlocks(input).flatMap((block) => {
    const blockSegments = block.content && !isContentSourceEmpty(block.content)
      ? [
          renderPromptContentSegment(
            getPromptContentReferenceName(block.content, `block-${block.number}.txt`),
            readContentSourceAsPromptContent(block.content) ?? '',
          ),
        ]
      : [];
    const annotationSegments = block.annotations.flatMap((annotation, index) => {
      if (!annotation.content || isContentSourceEmpty(annotation.content)) {
        return [];
      }

      return [
        renderPromptContentSegment(
          getPromptContentReferenceName(annotation.content, `block-${block.number}-annotation-${index + 1}.txt`),
            readContentSourceAsPromptContent(annotation.content) ?? '',
        ),
      ];
    });
    return [...blockSegments, ...annotationSegments].filter((value): value is string => Boolean(value));
  });

  return segments.join('\n\n');
}

export function renderTextBlockMetadataForModel(input: EvaluationInput): string {
  const { submissionData } = prepareEvaluationSubmission(input);

  return JSON.stringify(
    {
      textType: submissionData.textType,
      textCompleteness: submissionData.textCompleteness,
      evaluationGoal: submissionData.evaluationGoal,
      blocks: submissionData.blocks.map((block) => ({
        id: block.id,
        number: block.number,
        blockType: block.blockType,
        title: block.title,
        content: getPromptMetadataContent(block.content, `block-${block.number}.txt`),
        annotations: block.annotations.map((annotation, index) => ({
          id: annotation.id,
          content: getPromptMetadataContent(annotation.content, `block-${block.number}-annotation-${index + 1}.txt`),
        })),
      })),
      metadata: submissionData.metadata,
    },
    null,
    2,
  );
}

export function summarizeTextBlocks(input: Pick<EvaluationInput, 'textBlocks'>): string {
  const renderableBlocks = getRenderableTextBlocks(input);

  if (renderableBlocks.length === 0) {
    return '未提供文本块';
  }

  return renderableBlocks
    .map((block) => `${block.number}. ${getTextBlockTypeLabel(block.blockType)} / ${block.title.trim() || getDefaultBlockTitle(block)}`)
    .join('；');
}

export function getTextBlockPlainTextLength(input: Pick<EvaluationInput, 'textBlocks'>): number {
  return input.textBlocks.reduce(
    (total, block) =>
      total +
      getContentSourceRawLength(block.content) +
      block.annotations.reduce((annotationTotal, annotation) => annotationTotal + getContentSourceRawLength(annotation.content), 0),
    0,
  );
}

export function getRenderedTextBlockLength(input: Pick<EvaluationInput, 'textBlocks'>): number {
  return renderTextBlocksForModel(input).length;
}

export function toSerializableEvaluationInput(input: EvaluationInput): SerializableEvaluationInput {
  return prepareEvaluationSubmission(input).submissionData;
}
