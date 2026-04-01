import {
  ChatCompletionsRequest,
  ChatCompletionsResult,
  ConfigValidationResult,
  ModelConfigProvider,
  ModelInfo,
  ModelListResponse,
} from '@/types/modelConfig';
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

      let response: Response;
      try {
        response = await fetch(`${cleanBaseUrl}/models`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${cleanApiKey}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        });
      } catch (fetchError) {
        clearTimeout(timeoutId);
        // 检查是否为超时错误
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          return {
            success: false,
            error: {
              code: 'provider_request_timeout',
              message: '验证超时，请检查网络连接或稍后重试',
              retryable: true,
            },
          };
        }
        throw fetchError;
      }

      clearTimeout(timeoutId);

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

      const response = await fetch(`${cleanBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
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
            message: `请求失败：${errorMsg}`,
            retryable: response.status >= 500,
            status: response.status,
          },
        };
      }

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
