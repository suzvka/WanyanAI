import { AnalysisPhase, AnalysisStatus } from '@/types/appFlow';
import { AnalysisResult, PromptTemplateRequest, PromptTemplateResource } from '@/types/analysis';
import { ModelConfig } from '@/types/modelConfig';
import { EvaluationInput } from '@/types/report';

export type AnalysisStage = AnalysisPhase;

export type AnalysisProgressUpdate = {
  stage: AnalysisStage;
  message?: string;
  status?: Extract<AnalysisStatus, 'running' | 'recovering'>;
};

export type GenerateReportOptions = {
  input: EvaluationInput;
  modelConfig: ModelConfig;
  onProgress?: (update: AnalysisProgressUpdate) => void;
};

export interface PromptTemplateService {
  getTemplate(request: PromptTemplateRequest): Promise<PromptTemplateResource>;
}

export interface AnalysisService {
  generateReport(options: GenerateReportOptions): Promise<AnalysisResult>;
}
