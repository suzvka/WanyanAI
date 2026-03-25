import { z } from 'zod';
import { EvaluationInput, TextBlock, TextBlockAttachment } from '@/types/report';
import type { FeatureFlagsConfig } from '@/server/config/types';
import { getRenderedTextBlockLength, MAX_BLOCK_CONTENT_LENGTH } from '@/lib/textBlocks';

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

const readerPreferenceSchema = z.enum([
  'fast_paced',
  'plot_driven',
  'character_emotion',
  'world_building',
  'literary_expression',
  'general_reader',
]);

const feedbackStyleSchema = z.enum(['strict', 'balanced', 'encouraging']);

const specialConstraintSchema = z.enum([
  'keep_original_style',
  'avoid_overwriting',
  'focus_publishability',
  'focus_literary_expression',
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

const textBlockContentUnitSchema = z
  .object({
    draftText: z.string().default(''),
    file: textBlockAttachmentSchema.nullable().default(null),
  })
  .superRefine((unit: { draftText: string; file: TextBlockAttachment | null }, ctx: z.RefinementCtx) => {
    if (unit.draftText.trim() && unit.file) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '单个内容单元中，文本与文件不能同时存在',
        path: ['draftText'],
      });
    }
  });

const textBlockSupplementSchema = textBlockContentUnitSchema.extend({
  id: z.string().trim().min(1, '说明标识缺失'),
});

const textBlockSchema = textBlockContentUnitSchema.extend({
  id: z.string().trim().min(1, '文本块标识缺失'),
  number: z.number().int().min(1, '文本块编号不合法'),
  blockType: textBlockTypeSchema,
  title: z.string().default(''),
  localSupplements: z.array(textBlockSupplementSchema).default([]),
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
  globalSupplementBlocks: z.array(textBlockSchema),
  textType: textTypeSchema,
  textCompleteness: textCompletenessSchema,
  evaluationGoal: evaluationGoalSchema,
  readerPreference: readerPreferenceSchema.optional(),
  feedbackStyle: feedbackStyleSchema.optional(),
  specialConstraints: z.array(specialConstraintSchema).optional(),
});

export type EvaluationFormErrors = Partial<Record<keyof EvaluationInput | 'form', string>>;

type ValidationOptions = {
  featureFlags?: Partial<FeatureFlagsConfig>;
};

function hasAnyFiles(input: EvaluationInput) {
  return [...input.textBlocks, ...input.globalSupplementBlocks].some(
    (block) => block.file !== null || block.localSupplements.some((supplement) => supplement.file !== null),
  );
}

function hasAnyLocalSupplements(input: EvaluationInput) {
  return [...input.textBlocks, ...input.globalSupplementBlocks].some((block) => block.localSupplements.length > 0);
}

export function validateEvaluationInput(input: EvaluationInput, options: ValidationOptions = {}):
  | { success: true; data: EvaluationInput }
  | { success: false; errors: EvaluationFormErrors } {
  const result = evaluationInputSchema.safeParse(input);

  if (result.success) {
    if (options.featureFlags?.enableGlobalSupplementBlocks === false && result.data.globalSupplementBlocks.length > 0) {
      return {
        success: false,
        errors: {
          globalSupplementBlocks: '当前配置已关闭整体说明块。',
        },
      };
    }

    if (options.featureFlags?.enableLocalSupplements === false && hasAnyLocalSupplements(result.data)) {
      return {
        success: false,
        errors: {
          textBlocks: '当前配置已关闭局部说明。',
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
