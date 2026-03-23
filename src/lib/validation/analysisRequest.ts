import { z } from 'zod';
import { analysisRequestSchema } from '@/types/analysis';

export function validateAnalysisRequest(input: unknown) {
  return analysisRequestSchema.safeParse(input);
}

export type AnalysisRequestValidationResult = ReturnType<typeof validateAnalysisRequest>;
