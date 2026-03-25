import {
  ConfigValidationResult,
  ModelConfigProvider,
  ModelInfo,
  ModelListResponse,
} from '@/types/modelConfig';
import { validateModelConnectionInput } from '@/lib/validation/modelConfig';
import { toAppErrorPayload } from '@/types/errors';

const normalizeBaseUrl = (baseUrl: string) => baseUrl.trim().replace(/\/$/, '');

function normalizeModels(response: ModelListResponse): ModelInfo[] | null {
  if (!Array.isArray(response.data)) {
    return null;
  }

  return response.data
    .filter((model) => typeof model.id === 'string' && model.id.trim().length > 0)
    .map((model) => ({
      id: model.id,
      name: model.id,
      description: model.description || '',
    }));
}

export const modelConfigProvider: ModelConfigProvider = {
  async validateAndFetchModels(baseUrl: string, apiKey: string): Promise<ConfigValidationResult> {
    try {
      const validatedConnection = validateModelConnectionInput(baseUrl, apiKey);
      if (!validatedConnection.success) {
        return {
          success: false,
          error: {
            code: 'config_invalid',
            message: validatedConnection.error,
          },
        };
      }

      const cleanBaseUrl = normalizeBaseUrl(validatedConnection.data.baseUrl);
      const cleanApiKey = validatedConnection.data.apiKey;

      const response = await fetch(`${cleanBaseUrl}/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${cleanApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        let errorMsg = `HTTP ${response.status}`;

        try {
          const errorData = (await response.json()) as { error?: { message?: string } };
          errorMsg = errorData.error?.message || errorMsg;
        } catch {
          // 忽略响应体解析错误
        }

        return {
          success: false,
          error: {
            code: 'provider_request_failed',
            message: `验证失败：${errorMsg}`,
            retryable: response.status >= 500,
            status: response.status,
          },
        };
      }

      const data = (await response.json()) as ModelListResponse;
      const models = normalizeModels(data);

      if (!models) {
        return {
          success: false,
          error: {
            code: 'provider_response_invalid',
            message: '模型列表响应格式异常',
          },
        };
      }

      return {
        success: true,
        models,
      };
    } catch (error) {
      console.error('Validation error:', error);
      return {
        success: false,
        error: toAppErrorPayload(error, {
          code: 'provider_request_failed',
          message: '验证失败，请检查 URL 和 API Key',
          retryable: true,
        }),
      };
    }
  },
};
