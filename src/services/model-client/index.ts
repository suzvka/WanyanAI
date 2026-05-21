import type { ModelClient, ModelClientConfig, ChatParams } from './types';
import { requestResponse } from '@/lib/client-request';

export type { ModelClient, ModelClientConfig, ChatParams };

const log = (message: string, data?: unknown) => {
  console.log(`[modelClient] ${message}`, data !== undefined ? data : '');
};

class DefaultModelClient implements ModelClient {
  private config: ModelClientConfig = { baseUrl: '' };

  configure(config: ModelClientConfig): void {
    this.config = {
      baseUrl: config.baseUrl.replace(/\/$/, ''),
      apiKey: config.apiKey,
    };
    log('configured', { baseUrl: this.config.baseUrl, hasKey: !!this.config.apiKey });
  }

  async chat(params: ChatParams): Promise<Record<string, unknown>> {
    const body = JSON.stringify(params);

    const response = await requestResponse(
      `${this.config.baseUrl}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey
            ? { Authorization: `Bearer ${this.config.apiKey}` }
            : {}),
        },
        body,
        errorCode: 'provider_request_failed',
        errorMessage: '模型请求失败',
        networkErrorMessage: '模型请求失败，请检查网络连接或服务配置后重试',
      },
    );

    const text = await response.text();
    return JSON.parse(text) as Record<string, unknown>;
  }

  async *chatStream(params: ChatParams): AsyncIterable<string> {
    const body = JSON.stringify({ ...params, stream: true });

    const response = await requestResponse(
      `${this.config.baseUrl}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey
            ? { Authorization: `Bearer ${this.config.apiKey}` }
            : {}),
        },
        body,
        errorCode: 'provider_request_failed',
        errorMessage: '模型请求失败',
        networkErrorMessage: '模型请求失败，请检查网络连接或服务配置后重试',
      },
    );

    if (!response.body) {
      throw new Error('响应体为空');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data:')) {
            const data = line.substring(5).trim();
            if (data === '[DONE]') return;

            try {
              const parsed = JSON.parse(data);
              const content: string | undefined =
                parsed.choices?.[0]?.delta?.content;
              if (content) yield content;
            } catch {
              // 跳过无法解析的行
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

export const modelClient: ModelClient = new DefaultModelClient();
