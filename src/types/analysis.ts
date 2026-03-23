import { AnalysisReport, EvaluationInput } from '@/types/report';

export type AnalysisRequest = EvaluationInput;

export type AnalysisSuccessResponse = {
  report: AnalysisReport;
};

export type AnalysisErrorResponse = {
  error: string;
};
