import { z } from 'zod';
import { evaluationGoalValues } from '@/config/evaluationDimensions';

export const promptFrameworkCompileRequestSchema = z.object({
  evaluationGoal: z.enum(evaluationGoalValues),
  outputMode: z.string().optional(),
});

export function validatePromptTemplateRequest(input: unknown) {
  return promptFrameworkCompileRequestSchema.safeParse(input);
}

export type PromptTemplateRequestValidationResult = ReturnType<typeof validatePromptTemplateRequest>;
