import type { AnalysisReport, EvaluationGoal } from '@/types/report';
import type { AppErrorPayload } from '@/types/errors';

export const providerProfileValues = ['openai-compatible'] as const;
export type ProviderProfile = (typeof providerProfileValues)[number];

export type PromptTemplateSlotKey =
  | 'textBlocksPlainText'
  | 'textBlocksSummary'
  | 'textTypeLabel'
  | 'textCompletenessLabel'
  | 'evaluationGoalLabel'
  | 'dynamicInstructionText';

export type PromptTemplateSlotDefinition = {
  key: PromptTemplateSlotKey;
  label: string;
  required: boolean;
};

export type PromptTemplateResource = {
  templateId: string;
  version: string;
  scenario: 'text_diagnosis';
  providerProfile: ProviderProfile;
  evaluationGoal: EvaluationGoal;
  title: string;
  systemPromptTemplate: string;
  userPromptTemplate: string;
  slots: PromptTemplateSlotDefinition[];
  outputSchemaRef: string;
  policyMeta: {
    scoringPolicyVersion: string;
    conclusionPolicyVersion: string;
    reportFormatVersion: string;
  };
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
  error: AppErrorPayload;
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

export type RawModelResponseSource = 'output_text' | 'choice_text' | 'message_content';

export type RawModelResponse = {
  content: string;
  source: RawModelResponseSource;
};

export type ParsedAnalysisPayload = {
  rawText: string;
  jsonText: string;
  parsed: unknown;
  usedFenceExtraction: boolean;
  usedBracketExtraction: boolean;
  usedRepair: boolean;
};

export type AnalysisRepairAttempt = {
  attempted: boolean;
  success: boolean;
  reason?: string;
};

export type AnalysisResult = AnalysisReport;
