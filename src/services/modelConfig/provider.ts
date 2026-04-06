import {
  ChatCompletionsRequest,
  ChatCompletionsResult,
  ConfigValidationResult,
  ModelConfigProvider,
  ModelInfo,
  ModelListResponse,
} from '@/types/modelConfig';
import { requestJson, requestResponse } from '@/lib/client-request';
import { validateModelConnectionInput } from '@/lib/validation/modelConfig';
import { toAppErrorPayload } from '@/types/errors';

const VALIDATION_TIMEOUT_MS = 5000; // 5秒超时

const normalizeBaseUrl = (baseUrl: string) => baseUrl.trim().replace(/\/$/, '');

function normalizeModels(response: ModelListResponse): ModelInfo[] | null {
  if (!Array.isArray(response.data)) {
    return null;
  }

  return response.data
    .filter((model) => typeof model.id === 'string' && model.id.trim().length > 0)
    .map((model) => ({
      id: model.id,
      name: model.name || model.id, // 优先使用 name，否则使用 id
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

      // 创建 AbortController 用于超时控制
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), VALIDATION_TIMEOUT_MS);

      const data = await (async () => {
        try {
          return await requestJson<ModelListResponse>(`${cleanBaseUrl}/models`, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${cleanApiKey}`,
              'Content-Type': 'application/json',
            },
            credentials: 'same-origin',
            signal: controller.signal,
            errorCode: 'provider_request_failed',
            errorMessage: '验证失败，请检查 URL 和 API Key',
            networkErrorMessage: '验证失败，请检查 URL 和 API Key',
            reportMessage: '模型配置验证失败',
            abortErrorPayload: {
              code: 'provider_request_timeout',
              message: '验证超时，请检查网络连接或稍后重试',
              retryable: true,
            },
          });
        } finally {
          clearTimeout(timeoutId);
        }
      })();

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

  /**
   * Chat Completions 请求转发
   * 支持流式和非流式两种模式
   */
  async chatCompletions(
    baseUrl: string,
    apiKey: string,
    body: ChatCompletionsRequest
  ): Promise<ChatCompletionsResult> {
    try {
      const cleanBaseUrl = normalizeBaseUrl(baseUrl);

      const response = await requestResponse(`${cleanBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify(body),
        errorCode: 'provider_request_failed',
        errorMessage: '请求失败，请检查网络连接',
        networkErrorMessage: '请求失败，请检查网络连接',
        reportMessage: '模型服务请求失败',
      });

      // 返回原始响应（支持流式和非流式）
      return {
        success: true,
        response,
      };
    } catch (error) {
      return {
        success: false,
        error: toAppErrorPayload(error, {
          code: 'provider_request_failed',
          message: '请求失败，请检查网络连接',
          retryable: true,
        }),
      };
    }
  },
};
