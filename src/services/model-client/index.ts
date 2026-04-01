import type { AnalysisEventHandlers } from '@/types/streamEvents';
import { StreamingClient } from '@/services/analysis/streamingClient';
import type { ModelAnalysisRequest } from '@/types/analysis';
import type { ModelClient, ModelClientOptions, ModelClientResult } from './types';

export type { ModelClient, ModelClientOptions, ModelClientResult };

/**
 * 默认 ModelClient 实现
 * 
 * 基于 StreamingClient，提供简洁的 API 调用接口
 */
class DefaultModelClient implements ModelClient {
  async call(options: ModelClientOptions): Promise<ModelClientResult> {
    const { baseUrl, apiKey, model, messages, temperature, maxTokens, events } = options;

    const payload: ModelAnalysisRequest = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    };

    const client = new StreamingClient({
      baseUrl,
      apiKey,
      payload,
      eventHandlers: events,
    });

    const result = await client.execute();

    return {
      content: result.response.content,
      finishReason: result.response.finishReason,
    };
  }
}

/**
 * 默认导出的 ModelClient 实例
 */
export const modelClient: ModelClient = new DefaultModelClient();
