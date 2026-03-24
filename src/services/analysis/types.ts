import { AnalysisResult, PromptTemplateRequest, PromptTemplateResource } from '@/types/analysis';
import { ModelConfig } from '@/types/modelConfig';
import { EvaluationInput } from '@/types/report';

export type AnalysisStage = 'fetch-template' | 'build-prompt' | 'request-model' | 'parse-report';

export type GenerateReportOptions = {
  input: EvaluationInput;
  modelConfig: ModelConfig;
  onProgress?: (stage: AnalysisStage) => void;
};

export interface PromptTemplateService {
  getTemplate(request: PromptTemplateRequest): Promise<PromptTemplateResource>;
}

export interface AnalysisService {
  generateReport(options: GenerateReportOptions): Promise<AnalysisResult>;
}
