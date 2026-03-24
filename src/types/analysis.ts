import { z } from 'zod';
import { AnalysisReport, EvaluationGoal } from '@/types/report';

const evaluationGoalValues: [EvaluationGoal, ...EvaluationGoal[]] = [
  'overall_check',
  'opening_attraction',
  'rhythm_progression',
  'character_development',
  'style_consistency',
  'structure_completeness',
  'reader_acceptance',
];

export const analysisRequestSchema = z.object({
  evaluationGoal: z.enum(evaluationGoalValues),
});

export type PromptTemplateSlotKey =
  | 'textContent'
  | 'textTypeLabel'
  | 'textCompletenessLabel'
  | 'evaluationGoalLabel'
  | 'readerPreferenceLabel'
  | 'feedbackStyleLabel'
  | 'hasReferenceSampleLabel'
  | 'specialConstraintsLabel';

export type PromptTemplateSlotDefinition = {
  key: PromptTemplateSlotKey;
  label: string;
  required: boolean;
};

export type PromptTemplateResource = {
  id: string;
  version: string;
  evaluationGoal: EvaluationGoal;
  title: string;
  systemPromptTemplate: string;
  userPromptTemplate: string;
  slots: PromptTemplateSlotDefinition[];
  recommendedParameters: {
    temperature: number;
    maxTokens: number;
  };
};

export type PromptTemplateRequest = {
  evaluationGoal: EvaluationGoal;
};

export type PromptTemplateSuccessResponse = {
  template: PromptTemplateResource;
};

export type PromptTemplateErrorResponse = {
  error: string;
};

export type ModelAnalysisRequest = {
  model: string;
  messages: Array<{
    role: 'system' | 'user';
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
};

export type AnalysisResult = AnalysisReport;
