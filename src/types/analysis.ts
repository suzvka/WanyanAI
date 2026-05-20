import type { AppErrorPayload } from '@/types/errors';

export type AnalysisResult = unknown;

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

export type ReportScoringContext = {
  multipliers: Record<string, number>;
  defaultMultiplier: number;
};

export const DEFAULT_SCORING_CONTEXT: ReportScoringContext = {
  multipliers: {},
  defaultMultiplier: 1,
};

export type AnalysisReportMetadata = {
  model: string;
  baseUrl: string;
  outputMode: string;
  moduleId: string;
};

export type PersistedAnalysisReport = {
  reportId: string;
  moduleId: string;
  outputMode: string;
  createdAt: string;
  rawJson: unknown;
  metadata: AnalysisReportMetadata;
  scoringContext: ReportScoringContext;
};
