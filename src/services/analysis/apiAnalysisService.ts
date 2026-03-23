import {
  AnalysisErrorResponse,
  AnalysisRequest,
  AnalysisSuccessResponse,
} from '@/types/analysis';
import { AnalysisReport } from '@/types/report';
import { AnalysisService } from './types';

export class ApiAnalysisService implements AnalysisService {
  async generateReport(input: AnalysisRequest): Promise<AnalysisReport> {
    const response = await fetch('/api/analysis', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    const data = (await response.json()) as AnalysisSuccessResponse | AnalysisErrorResponse;

    if (!response.ok) {
      throw new Error('error' in data ? data.error : '分析请求失败');
    }

    if (!('report' in data)) {
      throw new Error('分析响应格式异常');
    }

    return data.report;
  }
}
