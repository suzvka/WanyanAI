import { prepareEvaluationSubmission } from '@/lib/evaluationSubmission';
import type {
  ContainerData,
  ContentSource,
  EvaluationInput,
  SerializableEvaluationInput,
  SerializableTextBlockContent,
  TextAnnotation,
  TextBlock,
  TextBlockAttachment,
} from '@/types/report';

export const MAX_BLOCK_CONTENT_LENGTH = 100000;

/**
 * 文本块元数据结构
 */
type TextBlockMetadata = {
  containerTitle: string;
  texts: Array<{
    title?: string;
    fileName?: string;
    annotations?: Array<{ fileName?: string }>;
  }>;
  prompt?: string;
};

type TextBlocksMetadataOutput = {
  containers: TextBlockMetadata[];
};

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

function getPromptMetadataContentFromSource(
  content: ContentSource | null,
  fallbackFileName: string,
): { kind: 'text' | 'file'; fileName: string } | null {
  if (!content) {
    return null;
  }

  if (content.kind === 'file') {
    return {
      kind: 'file',
      fileName: content.file.storedName,
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

/**
 * 获取默认块标题
 */
function getDefaultBlockTitle(index: number): string {
  return `文本${index + 1}`;
}

/**
 * 渲染文本块内容供模型使用
 */
export function renderTextBlocksForModel(input: EvaluationInput): string {
  const segments: string[] = [];

  for (const container of input.containers) {
    const renderableBlocks = container.textBlocks.filter((block) => hasRenderableTextBlockContent(block));

    renderableBlocks.forEach((block, blockIndex) => {
      // 添加文本块内容
      if (block.content && !isContentSourceEmpty(block.content)) {
        segments.push(
          renderPromptContentSegment(
            getPromptContentReferenceName(block.content, `${container.id}-${blockIndex + 1}.txt`),
            readContentSourceAsPromptContent(block.content) ?? '',
          ),
        );
      }

      // 添加批注内容
      block.annotations.forEach((annotation, annIndex) => {
        if (annotation.content && !isContentSourceEmpty(annotation.content)) {
          segments.push(
            renderPromptContentSegment(
              getPromptContentReferenceName(annotation.content, `${container.id}-${blockIndex + 1}-annotation-${annIndex + 1}.txt`),
              readContentSourceAsPromptContent(annotation.content) ?? '',
            ),
          );
        }
      });
    });
  }

  return segments.join('\n\n');
}

/**
 * 渲染文本块元数据供模型使用
 */
export function renderTextBlockMetadataForModel(input: EvaluationInput): string {
  return JSON.stringify({ containers: buildTextBlockMetadataContainers(input) }, null, 2);
}

/**
 * 构建文本块元数据容器列表
 */
function buildTextBlockMetadataContainers(input: EvaluationInput): TextBlockMetadata[] {
  const containers: TextBlockMetadata[] = [];

  for (const container of input.containers) {
    const renderableBlocks = container.textBlocks.filter((block) => hasRenderableTextBlockContent(block));

    if (renderableBlocks.length === 0) {
      continue;
    }

    const containerMetadata: TextBlockMetadata = {
      containerTitle: container.title,
      texts: renderableBlocks.map((block, blockIndex) => {
        const text: { title?: string; fileName?: string; annotations?: Array<{ fileName?: string }> } = {};

        const title = block.title.trim() || getDefaultBlockTitle(blockIndex);
        if (title) {
          text.title = title;
        }

        const contentMeta = getPromptMetadataContentFromSource(
          block.content,
          `${container.id}-${blockIndex + 1}.txt`
        );
        if (contentMeta) {
          text.fileName = contentMeta.fileName;
        }

        const renderableAnnotations = block.annotations.filter(
          (annotation) => annotation.content && !isContentSourceEmpty(annotation.content)
        );

        if (renderableAnnotations.length > 0) {
          text.annotations = renderableAnnotations.map((annotation, annIndex) => {
            const annotationMeta: { fileName?: string } = {};
            const annotationContentMeta = getPromptMetadataContentFromSource(
              annotation.content,
              `${container.id}-${blockIndex + 1}-annotation-${annIndex + 1}.txt`
            );
            if (annotationContentMeta) {
              annotationMeta.fileName = annotationContentMeta.fileName;
            }
            return annotationMeta;
          });
        }

        return text;
      }),
    };

    // 注入容器级提示词
    if (container.prompt) {
      containerMetadata.prompt = container.prompt;
    }

    containers.push(containerMetadata);
  }

  return containers;
}

/**
 * 汇总文本块信息
 */
export function summarizeTextBlocks(input: EvaluationInput): string {
  const segments: string[] = [];

  for (const container of input.containers) {
    const renderableBlocks = container.textBlocks.filter((block) => hasRenderableTextBlockContent(block));

    if (renderableBlocks.length > 0) {
      const blockSummaries = renderableBlocks.map((block, index) => {
        const title = block.title.trim() || getDefaultBlockTitle(index);
        return `${container.title} - ${title}`;
      });
      segments.push(...blockSummaries);
    }
  }

  return segments.length > 0 ? segments.join('；') : '未提供文本块';
}

/**
 * 获取文本块纯文本总长度
 */
export function getTextBlockPlainTextLength(input: Pick<EvaluationInput, 'textBlocks'>): number {
  return input.textBlocks.reduce(
    (total, block) =>
      total +
      getContentSourceRawLength(block.content) +
      block.annotations.reduce((annotationTotal, annotation) => annotationTotal + getContentSourceRawLength(annotation.content), 0),
    0,
  );
}

/**
 * 获取渲染后的文本块总长度
 */
export function getRenderedTextBlockLength(input: EvaluationInput): number {
  return renderTextBlocksForModel(input).length;
}

/**
 * 转换为可序列化的评估输入
 */
export function toSerializableEvaluationInput(input: EvaluationInput): SerializableEvaluationInput {
  return prepareEvaluationSubmission(input).submissionData;
}

// === 长度计算相关（用于文本块编辑器的限制检查）===

/**
 * 计算下一个原始长度
 */
export function getNextRawLength(
  textBlocks: TextBlock[],
  currentTextLength: number,
  nextTextLength: number,
): number {
  const currentTotal = textBlocks.reduce((total, block) => {
    const blockLength = getContentSourceRawLength(block.content);
    const annotationsLength = block.annotations.reduce(
      (annTotal, ann) => annTotal + getContentSourceRawLength(ann.content),
      0
    );
    return total + blockLength + annotationsLength;
  }, 0);

  return currentTotal - currentTextLength + nextTextLength;
}

/**
 * 检查是否在纯文本限制内
 */
export function isWithinPlainTextLimit(textBlocks: TextBlock[]): boolean {
  const totalLength = textBlocks.reduce((total, block) => {
    const blockLength = getContentSourceRawLength(block.content);
    const annotationsLength = block.annotations.reduce(
      (annTotal, ann) => annTotal + getContentSourceRawLength(ann.content),
      0
    );
    return total + blockLength + annotationsLength;
  }, 0);

  return totalLength <= MAX_BLOCK_CONTENT_LENGTH;
}

/**
 * 检查是否在渲染后文本限制内
 */
export function isWithinRenderedTextLimit(textBlocks: TextBlock[]): boolean {
  // 简化计算：纯文本长度 * 1.2 作为估算
  const plainLength = textBlocks.reduce((total, block) => {
    const blockLength = getContentSourceRawLength(block.content);
    const annotationsLength = block.annotations.reduce(
      (annTotal, ann) => annTotal + getContentSourceRawLength(ann.content),
      0
    );
    return total + blockLength + annotationsLength;
  }, 0);

  return plainLength * 1.2 <= MAX_BLOCK_CONTENT_LENGTH;
}

/**
 * 是否需要确认溢出
 */
export function shouldConfirmOverflow(
  textBlocks: TextBlock[],
  nextRawLength: number,
  hasConfirmedOverflow: boolean,
): boolean {
  if (hasConfirmedOverflow) {
    return false;
  }

  return nextRawLength > MAX_BLOCK_CONTENT_LENGTH;
}
