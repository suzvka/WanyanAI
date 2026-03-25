export type AppFlowStep = 'input' | 'analyzing' | 'report';

export type AnalysisPhase =
  | 'prepare-upload'
  | 'fetch-template'
  | 'build-prompt'
  | 'request-model'
  | 'extract-json'
  | 'repair-json'
  | 'normalize-report';

export type AnalysisStatus = 'idle' | 'running' | 'recovering' | 'failed';

export type AnalysisProgressState = {
  phase: AnalysisPhase;
  status: AnalysisStatus;
  message?: string;
  canRetry: boolean;
};
