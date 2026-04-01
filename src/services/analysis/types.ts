import type { AnalysisPhase, AnalysisStatus } from '@/types/appFlow';
import type { PromptTemplateRequest, PromptTemplateResource } from '@/types/analysis';

export type AnalysisStage = AnalysisPhase;

export type AnalysisProgressUpdate = {
  stage: AnalysisStage;
  message?: string;
  status?: Extract<AnalysisStatus, 'running' | 'recovering'>;
};

export interface PromptTemplateService {
  getTemplate(request: PromptTemplateRequest): Promise<PromptTemplateResource>;
}
