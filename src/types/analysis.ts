import type { EvaluationGoal } from '@/types/report';
import type { AppErrorPayload } from '@/types/errors';

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
  outputMode?: string;
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

/**
 * 分析结果类型
 * 
 * 使用 unknown 类型，由各输出模式自行解释
 */
export type AnalysisResult = unknown;
