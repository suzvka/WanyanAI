import { z } from 'zod';
import { ContentSource, EvaluationInput, TextBlock, TextBlockAttachment } from '@/types/report';
import type { FeatureFlagsConfig } from '@/server/config/types';
import {
  getRenderedTextBlockLength,
  isContentSourceEmpty,
  isTextAnnotationEmpty,
  MAX_BLOCK_CONTENT_LENGTH,
} from '@/lib/textBlocks';

const textTypeSchema = z.enum([
  'web_serial',
  'short_story',
  'light_novel',
  'literary_submission',
  'general_text',
]);

const textCompletenessSchema = z.enum([
  'complete',
  'single_chapter',
  'first_chapters',
  'excerpt',
  'draft',
]);

const evaluationGoalSchema = z.enum([
  'overall_check',
  'opening_attraction',
  'rhythm_progression',
  'character_development',
  'style_consistency',
  'structure_completeness',
  'reader_acceptance',
]);

const textBlockTypeSchema = z.enum(['actual_text', 'reference_material', 'reference_review']);

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
  number: z.number().int().min(1, '文本块编号不合法'),
  blockType: textBlockTypeSchema,
  title: z.string().default(''),
  content: contentSourceSchema,
  annotations: z.array(textAnnotationSchema).default([]),
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
  textType: textTypeSchema,
  textCompleteness: textCompletenessSchema,
  evaluationGoal: evaluationGoalSchema,
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

function getInvalidBlockNumbers(input: EvaluationInput) {
  return input.textBlocks.filter((block) => isContentSourceEmpty(block.content)).map((block) => block.number);
}

function getAnnotationOnlyBlockNumbers(input: EvaluationInput) {
  return input.textBlocks
    .filter(
      (block) => isContentSourceEmpty(block.content) && block.annotations.some((annotation) => !isTextAnnotationEmpty(annotation)),
    )
    .map((block) => block.number);
}

function formatBlockNumbers(blockNumbers: number[]) {
  return blockNumbers.join('、');
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

    const invalidBlockNumbers = getInvalidBlockNumbers(result.data);
    if (invalidBlockNumbers.length > 0) {
      const annotationOnlyBlockNumbers = getAnnotationOnlyBlockNumbers(result.data);
      const emptyBlockMessage = `文本块 ${formatBlockNumbers(invalidBlockNumbers)} 的正文为空，请填写正文或删除这些文本块后再提交。`;

      return {
        success: false,
        errors: {
          textBlocks:
            annotationOnlyBlockNumbers.length > 0
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
