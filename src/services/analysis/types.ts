import { AnalysisReport, EvaluationInput } from '@/types/report';

export interface AnalysisService {
  generateReport(input: EvaluationInput): Promise<AnalysisReport>;
}
