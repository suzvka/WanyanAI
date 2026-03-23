import { z } from 'zod';
import { EvaluationInput } from '@/types/report';

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

export const evaluationInputSchema = z.object({
  textContent: z.string().trim().min(1, '请输入要分析的文本内容'),
  textType: textTypeSchema,
  textCompleteness: textCompletenessSchema,
  evaluationGoal: evaluationGoalSchema,
  readerPreference: readerPreferenceSchema.optional(),
  feedbackStyle: feedbackStyleSchema.optional(),
  hasReferenceSample: z.boolean().optional(),
  specialConstraints: z.array(specialConstraintSchema).optional(),
});

export type EvaluationFormErrors = Partial<Record<keyof EvaluationInput | 'form', string>>;

export function validateEvaluationInput(input: EvaluationInput):
  | { success: true; data: EvaluationInput }
  | { success: false; errors: EvaluationFormErrors } {
  const result = evaluationInputSchema.safeParse(input);

  if (result.success) {
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
