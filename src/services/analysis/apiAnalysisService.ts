import {
  PromptTemplateErrorResponse,
  PromptTemplateRequest,
  PromptTemplateResource,
  PromptTemplateSuccessResponse,
} from '@/types/analysis';
import { PromptTemplateService } from './types';

export class ApiAnalysisService implements PromptTemplateService {
  async getTemplate(request: PromptTemplateRequest): Promise<PromptTemplateResource> {
    const searchParams = new URLSearchParams({
      evaluationGoal: request.evaluationGoal,
    });
    const response = await fetch(`/api/analysis?${searchParams.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = (await response.json()) as PromptTemplateSuccessResponse | PromptTemplateErrorResponse;

    if (!response.ok) {
      throw new Error('error' in data ? data.error : '分析请求失败');
    }

    if (!('template' in data)) {
      throw new Error('分析响应格式异常');
    }

    return data.template;
  }
}
