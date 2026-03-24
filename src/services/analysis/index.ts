import { ApiAnalysisService } from './apiAnalysisService';
import { BasicRemoteAnalysisService } from './basicRemoteAnalysisService';
import { MockAnalysisService } from './mockAnalysisService';

const promptTemplateService = new ApiAnalysisService();

export const analysisService = new BasicRemoteAnalysisService(promptTemplateService);
export const aiAnalysisService = analysisService;
export const mockAnalysisService = new MockAnalysisService();

export type { AnalysisService } from './types';
export { ApiAnalysisService } from './apiAnalysisService';
export { BasicRemoteAnalysisService } from './basicRemoteAnalysisService';
export { MockAnalysisService } from './mockAnalysisService';
