import { ApiAnalysisService } from './apiAnalysisService';
import { BasicRemoteAnalysisService } from './basicRemoteAnalysisService';

const promptTemplateService = new ApiAnalysisService();

export const analysisService = new BasicRemoteAnalysisService(promptTemplateService);
export const aiAnalysisService = analysisService;

export type { AnalysisService } from './types';
export { ApiAnalysisService } from './apiAnalysisService';
export { BasicRemoteAnalysisService } from './basicRemoteAnalysisService';
