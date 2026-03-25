import { z } from 'zod';
import { AnalysisReport, EvaluationGoal, TextBlockType } from '@/types/report';
import { AppErrorPayload } from '@/types/errors';

export const providerProfileValues = ['openai-compatible'] as const;
export type ProviderProfile = (typeof providerProfileValues)[number];

const evaluationGoalValues: [EvaluationGoal, ...EvaluationGoal[]] = [
  'overall_check',
  'opening_attraction',
  'rhythm_progression',
  'character_development',
  'style_consistency',
  'structure_completeness',
  'reader_acceptance',
];

const textBlockTypeValues: [TextBlockType, ...TextBlockType[]] = ['actual_text', 'reference_material', 'reference_review'];

export const promptFrameworkCompileRequestSchema = z.object({
  scenario: z.literal('text_diagnosis'),
  evaluationGoal: z.enum(evaluationGoalValues),
  providerProfile: z.enum(providerProfileValues),
  model: z.string().trim().min(1),
  inputMeta: z.object({
    blockTypes: z.array(z.enum(textBlockTypeValues)),
    blockCount: z.number().int().min(0),
    hasReferenceText: z.boolean(),
  }),
});

export type PromptTemplateSlotKey =
  | 'textBlocksPlainText'
  | 'textBlocksSummary'
  | 'textTypeLabel'
  | 'textCompletenessLabel'
  | 'evaluationGoalLabel'
  | 'readerPreferenceLabel'
  | 'feedbackStyleLabel'
  | 'specialConstraintsLabel';

export type PromptTemplateSlotDefinition = {
  key: PromptTemplateSlotKey;
  label: string;
  required: boolean;
};

export type PromptTemplateResource = {
  frameworkId: string;
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

export type PromptTemplateRequest = z.infer<typeof promptFrameworkCompileRequestSchema>;

export type PromptTemplateSuccessResponse = {
  framework: PromptTemplateResource;
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
