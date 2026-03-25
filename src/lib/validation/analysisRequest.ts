import { promptFrameworkCompileRequestSchema } from '@/types/analysis';

export function validateAnalysisRequest(input: unknown) {
  return promptFrameworkCompileRequestSchema.safeParse(input);
}

export type AnalysisRequestValidationResult = ReturnType<typeof validateAnalysisRequest>;
