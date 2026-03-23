'use client';

import { 
  ModelConfig, 
  ModelInfo, 
  ConfigValidationResult, 
  ModelTestResult,
  STORAGE_KEY 
} from '@/types/modelConfig';

export class ModelConfigService {
  // 从本地存储获取配置
  getConfig(): ModelConfig | null {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;
      return JSON.parse(stored);
    } catch (error) {
      console.error('Failed to read config from storage:', error);
      return null;
    }
  }

  // 保存配置到本地存储
  saveConfig(config: ModelConfig): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (error) {
      console.error('Failed to save config to storage:', error);
      throw new Error('保存配置失败');
    }
  }

  // 清除配置
  clearConfig(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
  }

  // 验证并获取可用模型列表
  async validateAndFetchModels(baseUrl: string, apiKey: string): Promise<ConfigValidationResult> {
    try {
      // 清理baseUrl，确保格式正确
      const cleanBaseUrl = baseUrl.trim().replace(/\/$/, '');
      
      if (!cleanBaseUrl) {
        return {
          success: false,
          error: '请输入Base URL'
        };
      }

      if (!apiKey) {
        return {
          success: false,
          error: '请输入API Key'
        };
      }

      // 尝试获取模型列表（兼容OpenAI格式）
      let models: ModelInfo[] = [];
      
      try {
        const modelsUrl = `${cleanBaseUrl}/models`;
        const response = await fetch(modelsUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.data && Array.isArray(data.data)) {
            models = data.data.map((model: any) => ({
              id: model.id,
              name: model.id,
              description: model.description || ''
            }));
          }
        }
      } catch (error) {
        console.log('Could not fetch models list, will proceed with manual input');
      }

      // 如果没有获取到模型列表，提供一些常见模型
      if (models.length === 0) {
        models = [
          { id: 'gpt-4', name: 'GPT-4' },
          { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
          { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
          { id: 'claude-3-opus', name: 'Claude 3 Opus' },
          { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet' },
          { id: 'claude-3-haiku', name: 'Claude 3 Haiku' }
        ];
      }

      return {
        success: true,
        models
      };
    } catch (error) {
      console.error('Validation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '验证失败，请检查URL和API Key'
      };
    }
  }

  // 测试模型连通性
  async testModelConnection(
    baseUrl: string, 
    apiKey: string, 
    model: string
  ): Promise<ModelTestResult> {
    try {
      const cleanBaseUrl = baseUrl.trim().replace(/\/$/, '');
      const chatUrl = `${cleanBaseUrl}/chat/completions`;

      // 构建测试消息，要求返回JSON格式
      const testMessage = {
        model: model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant. Please respond in JSON format with the following structure: {"status": "success", "message": "Connection test successful", "timestamp": current_time}'
          },
          {
            role: 'user',
            content: 'Please perform a connection test and respond in JSON format as instructed.'
          }
        ],
        temperature: 0.7,
        max_tokens: 200
      };

      const response = await fetch(chatUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testMessage)
      });

      if (!response.ok) {
        let errorMsg = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          errorMsg = errorData.error?.message || errorMsg;
        } catch {
          // 忽略
        }
        return {
          success: false,
          error: `模型连接失败: ${errorMsg}`
        };
      }

      const data = await response.json();
      
      // 验证响应格式
      if (!data.choices || !data.choices[0]?.message?.content) {
        return {
          success: false,
          error: '模型响应格式异常'
        };
      }

      return {
        success: true,
        response: data
      };
    } catch (error) {
      console.error('Model test error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '模型连接测试失败，请检查网络和配置'
      };
    }
  }
}

export const modelConfigService = new ModelConfigService();
