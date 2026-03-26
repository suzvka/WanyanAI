import { z } from 'zod';

const evaluationGoalValues = [
  'overall_check',
  'opening_attraction',
  'rhythm_progression',
  'character_development',
  'style_consistency',
  'structure_completeness',
  'reader_acceptance',
] as const;

export const promptFrameworkCompileRequestSchema = z.object({
  evaluationGoal: z.enum(evaluationGoalValues),
});

export function validatePromptTemplateRequest(input: unknown) {
  return promptFrameworkCompileRequestSchema.safeParse(input);
}

export type PromptTemplateRequestValidationResult = ReturnType<typeof validatePromptTemplateRequest>;
