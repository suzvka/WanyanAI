import {
  ConfigValidationResult,
  ModelConfigProvider,
  ModelInfo,
  ModelListResponse,
  ModelTestResult,
} from '@/types/modelConfig';
import { validateModelConfig, validateModelConnectionInput } from '@/lib/validation/modelConfig';

const fallbackModels: ModelInfo[] = [
  { id: 'gpt-4', name: 'GPT-4' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
  { id: 'claude-3-opus', name: 'Claude 3 Opus' },
  { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet' },
  { id: 'claude-3-haiku', name: 'Claude 3 Haiku' },
];

const normalizeBaseUrl = (baseUrl: string) => baseUrl.trim().replace(/\/$/, '');

export const modelConfigProvider: ModelConfigProvider = {
  async validateAndFetchModels(baseUrl: string, apiKey: string): Promise<ConfigValidationResult> {
    try {
      const validatedConnection = validateModelConnectionInput(baseUrl, apiKey);
      if (!validatedConnection.success) {
        return {
          success: false,
          error: validatedConnection.error,
        };
      }

      const cleanBaseUrl = normalizeBaseUrl(validatedConnection.data.baseUrl);
      const cleanApiKey = validatedConnection.data.apiKey;

      let models: ModelInfo[] = [];

      try {
        const response = await fetch(`${cleanBaseUrl}/models`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${cleanApiKey}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = (await response.json()) as ModelListResponse;
          if (Array.isArray(data.data)) {
            models = data.data.map((model) => ({
              id: model.id,
              name: model.id,
              description: model.description || '',
            }));
          }
        }
      } catch (error) {
        console.log('Could not fetch models list, will proceed with manual input', error);
      }

      return {
        success: true,
        models: models.length > 0 ? models : fallbackModels,
      };
    } catch (error) {
      console.error('Validation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '验证失败，请检查URL和API Key',
      };
    }
  },

  async testModelConnection(baseUrl: string, apiKey: string, model: string): Promise<ModelTestResult> {
    try {
      const validatedConfig = validateModelConfig({
        baseUrl,
        apiKey,
        selectedModel: model,
      });

      if (!validatedConfig.success) {
        return {
          success: false,
          error: validatedConfig.error,
        };
      }

      const cleanBaseUrl = normalizeBaseUrl(validatedConfig.data.baseUrl);
      const response = await fetch(`${cleanBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${validatedConfig.data.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: validatedConfig.data.selectedModel,
          messages: [
            {
              role: 'system',
              content:
                'You are a helpful assistant. Please respond in JSON format with the following structure: {"status": "success", "message": "Connection test successful", "timestamp": current_time}',
            },
            {
              role: 'user',
              content: 'Please perform a connection test and respond in JSON format as instructed.',
            },
          ],
          temperature: 0.7,
          max_tokens: 200,
        }),
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
          error: `模型连接失败: ${errorMsg}`,
        };
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      if (!data.choices?.[0]?.message?.content) {
        return {
          success: false,
          error: '模型响应格式异常',
        };
      }

      return {
        success: true,
        response: data,
      };
    } catch (error) {
      console.error('Model test error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '模型连接测试失败，请检查网络和配置',
      };
    }
  },
};
