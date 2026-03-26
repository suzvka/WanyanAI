import {
  PromptTemplateErrorResponse,
  PromptTemplateRequest,
  PromptTemplateResource,
  PromptTemplateSuccessResponse,
} from '@/types/analysis';
import { PromptTemplateService } from './types';
import { createAppError } from '@/types/errors';

async function readResponseData(response: Response): Promise<PromptTemplateSuccessResponse | PromptTemplateErrorResponse | null> {
  const text = await response.text();

  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text) as PromptTemplateSuccessResponse | PromptTemplateErrorResponse;
  } catch {
    return null;
  }
}

export class ApiAnalysisService implements PromptTemplateService {
  async getTemplate(request: PromptTemplateRequest): Promise<PromptTemplateResource> {
    let response: Response;

    try {
      response = await fetch('/api/templates/compile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });
    } catch {
      throw createAppError({
        code: 'network_error',
        message: '提示词模板请求失败，请检查网络连接后重试',
        retryable: true,
      });
    }

    const data = await readResponseData(response);

    if (!response.ok) {
      throw createAppError(
        data && 'error' in data
          ? data.error
          : {
              code: 'template_fetch_failed',
              message: '提示词模板请求失败',
              status: response.status,
              retryable: response.status >= 500,
            },
      );
    }

    if (!data || !('template' in data)) {
      throw createAppError({
        code: 'template_response_invalid',
        message: '提示词模板响应格式异常',
      });
    }

    return data.template;
  }
}
