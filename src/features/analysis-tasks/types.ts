import type { ProgressSnapshot } from '@/features/analysis-progress';
import type { ControlSelections, AnalysisParams } from '@/providers/PageContext';
import type { ModelConfig } from '@/types/modelConfig';
import type { PageModuleConfig } from '@/types/module';
import type { EvaluationInput } from '@/types/report';
import type { PersistedAnalysisReport } from '@/types/analysis';
import type { AnalysisPhase } from '@/types/appFlow';

export type AnalysisTaskStatus = 'queued' | 'running' | 'completed' | 'failed';

export type AnalysisTaskMeta = {
  phase: AnalysisPhase;
  message?: string;
  model: string;
  baseUrl: string;
  schedulerKey: string;
  errorMessage?: string;
};

export type AnalysisTaskRecord = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  moduleId: string;
  outputMode: string;
  status: AnalysisTaskStatus;
  progressSnapshot: ProgressSnapshot;
  taskMeta: AnalysisTaskMeta;
  report?: PersistedAnalysisReport;
};

export type CreateAnalysisTaskInput = {
  moduleConfig: PageModuleConfig;
  modelConfig: ModelConfig;
  controlSelections: ControlSelections;
  params: AnalysisParams;
  input: EvaluationInput;
  moduleName: string;
};

export type TaskSubscriptionListener = (record: AnalysisTaskRecord | null) => void;

export type RetryTaskResult = {
  taskId: string | null;
};
