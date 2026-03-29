import type { AnalysisReport, EvaluationGoal } from '@/types/report';
import type { AppErrorPayload } from '@/types/errors';
import type { ReportRating } from '@/config/reportScoring';

export const providerProfileValues = ['openai-compatible'] as const;
export type ProviderProfile = (typeof providerProfileValues)[number];

export type PromptTemplateSlotKey =
  | 'textBlocksPlainText'
  | 'textBlocksMetadata'
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
    maxTokens?: number;
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

export type ModelAnalysisMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type ModelAnalysisRequest = {
  model: string;
  messages: ModelAnalysisMessage[];
  temperature?: number;
  max_tokens?: number;
};

export const modelSubscoreIdValues = [
  'language_expression',
  'structural_logic',
  'human_depth',
  'inner_complexity',
  'semantic_openness',
  'empathic_effectiveness',
] as const;

export type ModelSubscoreId = (typeof modelSubscoreIdValues)[number];

export type ModelMinimalSummary = {
  title?: string;
  overview: string;
};

export type ModelMinimalSubscore = {
  id: ModelSubscoreId;
  grade: ReportRating;
  rationale: string;
};

export type ModelMinimalConclusion = {
  rationale: string;
};

export type ModelMinimalSection = {
  title: string;
  body: string;
};

export type ModelMinimalSectionGroup = {
  id?: string;
  title: string;
  sections: ModelMinimalSection[];
};

export type ModelMinimalReport = {
  summary: ModelMinimalSummary;
  subscores: ModelMinimalSubscore[];
  conclusion: ModelMinimalConclusion;
  groups?: ModelMinimalSectionGroup[];
  // sections 已迁移到 groups 中，保留为可选以兼容旧格式
  sections?: ModelMinimalSection[];
};

export type RawModelResponseSource = 'output_text' | 'choice_text' | 'message_content';

export type RawModelResponse = {
  content: string;
  source: RawModelResponseSource;
  finishReason?: string;
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
