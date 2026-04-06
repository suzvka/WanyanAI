import {
  PromptTemplateErrorResponse,
  PromptTemplateRequest,
  PromptTemplateResource,
  PromptTemplateSuccessResponse,
} from '@/types/analysis';
import { requestJson } from '@/lib/client-request';
import { PromptTemplateService } from './types';
import { createAppError } from '@/types/errors';

export class ApiAnalysisService implements PromptTemplateService {
  async getTemplate(request: PromptTemplateRequest): Promise<PromptTemplateResource> {
    const data = await requestJson<PromptTemplateSuccessResponse | PromptTemplateErrorResponse>('/api/templates/compile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      errorCode: 'template_fetch_failed',
      errorMessage: '提示词模板请求失败',
      networkErrorMessage: '提示词模板请求失败，请检查网络连接后重试',
    });

    if (!data || !('template' in data)) {
      throw createAppError({
        code: 'template_response_invalid',
        message: '提示词模板响应格式异常',
      });
    }

    return data.template;
  }
}
