import type { AnalysisEventHandlers } from '@/types/streamEvents';
import { StreamingMCPAdapter } from '@/mcp/streamingAdapter';
import type { ModelAnalysisRequest } from '@/types/analysis';
import type { ModelClient, ModelClientOptions, ModelClientResult } from './types';

export type { ModelClient, ModelClientOptions, ModelClientResult };

class DefaultModelClient implements ModelClient {
  async call(options: ModelClientOptions): Promise<ModelClientResult> {
    const { baseUrl, apiKey, model, messages, temperature, events, mcpToolDefinitions } = options;

    const payload: ModelAnalysisRequest = {
      model,
      messages,
      temperature,
    };

    const adapter = new StreamingMCPAdapter(
      model,
      temperature,
      events,
      mcpToolDefinitions,
      baseUrl,
      apiKey
    );

    const result = await adapter.sendMessage(payload);

    return {
      content: result.fullContent,
      finishReason: 'stop',
      toolCall: result.toolCall,
    };
  }
}

export const modelClient: ModelClient = new DefaultModelClient();
