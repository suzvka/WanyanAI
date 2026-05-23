import { z } from 'zod';
import type { ContentSource, EvaluationInput, TextBlock, TextBlockAttachment } from '@/types/report';
import type { FeatureFlagsConfig } from '@/server/config/types';
import {
  getRenderedTextBlockLength,
  isContentSourceEmpty,
  isTextAnnotationEmpty,
  MAX_BLOCK_CONTENT_LENGTH,
} from '@/lib/textBlocks';

const textBlockAttachmentSourceSchema = z.enum(['upload']);

const textBlockAttachmentSchema = z
  .object({
    id: z.string().trim().min(1, '文件标识缺失'),
    originalName: z.string().trim().min(1, '文件名缺失'),
    storedName: z.string().trim().min(1, '存储文件名缺失'),
    mimeType: z.string().default(''),
    size: z.number().nonnegative('文件大小不合法'),
    lastModified: z.number().int(),
    source: textBlockAttachmentSourceSchema,
    content: z.string().max(MAX_BLOCK_CONTENT_LENGTH, `单个文件不能超过 ${MAX_BLOCK_CONTENT_LENGTH} 字符`),
  })
  .superRefine((file: TextBlockAttachment, ctx: z.RefinementCtx) => {
    const mimeType = file.mimeType.trim().toLowerCase();
    const isPlainText = mimeType === '' || mimeType.startsWith('text/plain');
    const isTxtFile = file.originalName.toLowerCase().endsWith('.txt') || file.storedName.toLowerCase().endsWith('.txt');

    if (!isPlainText || !isTxtFile) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '当前仅支持 txt/plain text 文件。',
        path: ['storedName'],
      });
    }
  })
  .transform((value: unknown) => value as TextBlockAttachment);

const textContentSourceSchema = z.object({
  kind: z.literal('text'),
  text: z.string().default(''),
});

const fileContentSourceSchema = z.object({
  kind: z.literal('file'),
  file: textBlockAttachmentSchema,
});

const contentSourceSchema = z
  .discriminatedUnion('kind', [textContentSourceSchema, fileContentSourceSchema])
  .nullable()
  .default(null)
  .transform((value: ContentSource | null) => value);

const textAnnotationSchema = z.object({
  id: z.string().trim().min(1, '说明标识缺失'),
  content: contentSourceSchema,
});

const textBlockSchema = z.object({
  id: z.string().trim().min(1, '文本块标识缺失'),
  title: z.string().default(''),
  content: contentSourceSchema,
  annotations: z.array(textAnnotationSchema).default([]),
});

const containerDataSchema = z.object({
  id: z.string().trim().min(1, '容器标识缺失'),
  title: z.string().default(''),
  prompt: z.string().optional(),
  textBlocks: z.array(textBlockSchema).default([]),
});

export const evaluationInputSchema = z.object({
  textBlocks: z.array(textBlockSchema).superRefine((blocks: TextBlock[], ctx: z.RefinementCtx) => {
    const duplicatedIds = new Set<string>();
    const seenIds = new Set<string>();

    blocks.forEach((block, index) => {
      if (seenIds.has(block.id)) {
        duplicatedIds.add(block.id);
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '主文本块标识重复',
          path: [index, 'id'],
        });
      }

      seenIds.add(block.id);
    });
  }),
  containers: z.array(containerDataSchema).default([]),
});

export type EvaluationFormErrors = Partial<Record<keyof EvaluationInput | 'form', string>>;

type ValidationOptions = {
  featureFlags?: Partial<FeatureFlagsConfig>;
};

function hasAnyFiles(input: EvaluationInput) {
  return input.textBlocks.some(
    (block) =>
      block.content?.kind === 'file' || block.annotations.some((annotation) => annotation.content?.kind === 'file'),
  );
}

function hasAnyAnnotations(input: EvaluationInput) {
  return input.textBlocks.some((block) => block.annotations.length > 0);
}

/**
 * 获取无效块的位置信息（用于错误提示）
 */
function getInvalidBlockPositions(input: EvaluationInput) {
  const positions: string[] = [];
  
  for (const container of input.containers) {
    const invalidIndices: number[] = [];
    container.textBlocks.forEach((block, index) => {
      if (isContentSourceEmpty(block.content)) {
        invalidIndices.push(index + 1);
      }
    });
    
    if (invalidIndices.length > 0) {
      positions.push(`${container.title} 的第 ${invalidIndices.join('、')} 块`);
    }
  }
  
  return positions;
}

/**
 * 获取仅有批注的块的位置信息
 */
function getAnnotationOnlyBlockPositions(input: EvaluationInput) {
  const positions: string[] = [];
  
  for (const container of input.containers) {
    const annotationOnlyIndices: number[] = [];
    container.textBlocks.forEach((block, index) => {
      if (isContentSourceEmpty(block.content) && block.annotations.some((annotation) => !isTextAnnotationEmpty(annotation))) {
        annotationOnlyIndices.push(index + 1);
      }
    });
    
    if (annotationOnlyIndices.length > 0) {
      positions.push(`${container.title} 的第 ${annotationOnlyIndices.join('、')} 块`);
    }
  }
  
  return positions;
}

export function validateEvaluationInput(input: EvaluationInput, options: ValidationOptions = {}):
  | { success: true; data: EvaluationInput }
  | { success: false; errors: EvaluationFormErrors } {
  const result = evaluationInputSchema.safeParse(input);

  if (result.success) {
    if (result.data.textBlocks.length === 0) {
      return {
        success: false,
        errors: {
          textBlocks: '请至少添加一个文本块并填写正文后再提交。',
        },
      };
    }

    const invalidBlockPositions = getInvalidBlockPositions(result.data);
    if (invalidBlockPositions.length > 0) {
      const annotationOnlyPositions = getAnnotationOnlyBlockPositions(result.data);
      const emptyBlockMessage = `${invalidBlockPositions.join('、')} 的正文为空，请填写正文或删除这些文本块后再提交。`;

      return {
        success: false,
        errors: {
          textBlocks:
            annotationOnlyPositions.length > 0
              ? `${emptyBlockMessage} 批注不能脱离正文单独提交。`
              : emptyBlockMessage,
        },
      };
    }

    if (options.featureFlags?.enableAnnotations === false && hasAnyAnnotations(result.data)) {
      return {
        success: false,
        errors: {
          textBlocks: '当前配置已关闭批注。',
        },
      };
    }

    if (options.featureFlags?.enableFileUpload === false && hasAnyFiles(result.data)) {
      return {
        success: false,
        errors: {
          form: '当前配置仅支持纯文本输入，请移除文件后再提交。',
        },
      };
    }

    if (getRenderedTextBlockLength(result.data) > MAX_BLOCK_CONTENT_LENGTH) {
      return {
        success: false,
        errors: {
          form: `渲染后的文本长度超过 ${MAX_BLOCK_CONTENT_LENGTH} 字符，请删减后再提交。`,
        },
      };
    }

    return {
      success: true,
      data: result.data,
    };
  }

  const errors: EvaluationFormErrors = {};

  for (const issue of result.error.issues) {
    const path = issue.path[0];
    if (typeof path === 'string' && !(path in errors)) {
      errors[path as keyof EvaluationInput] = issue.message;
    }
  }

  return {
    success: false,
    errors,
  };
}
