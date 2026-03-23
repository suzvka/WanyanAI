import { ApiAnalysisService } from './apiAnalysisService';
import { MockAnalysisService } from './mockAnalysisService';

export const analysisService = new ApiAnalysisService();
export const aiAnalysisService = analysisService;
export const mockAnalysisService = new MockAnalysisService();

export type { AnalysisService } from './types';
export { ApiAnalysisService } from './apiAnalysisService';
export { MockAnalysisService } from './mockAnalysisService';
