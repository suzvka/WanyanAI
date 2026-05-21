import type { AnalysisEventHandlers } from '@/types/streamEvents';
import { StreamingMCPAdapter } from '@/mcp/streamingAdapter';
import type { ModelAnalysisRequest } from '@/types/analysis';
import type { ModelClient, ModelClientOptions, ModelClientResult, ModelClientToolCallOptions, ModelClientToolCallResult } from './types';

export type { ModelClient, ModelClientOptions, ModelClientResult, ModelClientToolCallOptions, ModelClientToolCallResult };

const log = (message: string, data?: unknown) => {
  console.log(`[modelClient] ${message}`, data !== undefined ? data : '');
};

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

  async callWithTools(options: ModelClientToolCallOptions): Promise<ModelClientToolCallResult> {
    const { baseUrl, apiKey, model, messages, tools, temperature, maxIterations, currentIteration } = options;

    const toolChoice = (maxIterations !== undefined && currentIteration !== undefined && currentIteration >= maxIterations)
      ? 'none'
      : 'auto';

    log('callWithTools', { model, toolCount: tools.length, temperature, toolChoice, iteration: currentIteration });

    const httpResponse = await fetch(
      `${baseUrl.replace(/\/$/, '')}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          tools,
          tool_choice: toolChoice,
          temperature: temperature ?? 0.3,
        }),
      },
    );

    if (!httpResponse.ok) {
      const errorBody = await httpResponse.text();
      log('callWithTools failed', { status: httpResponse.status, errorBody });
      throw new Error(`Tool call request failed (${httpResponse.status})`);
    }

    const responseData = await httpResponse.json();
    const choice = responseData.choices?.[0];
    if (!choice) {
      log('No choices in response');
      throw new Error('模型未返回有效响应');
    }

    const assistantMessage = choice.message;

    return {
      content: assistantMessage.content ?? null,
      toolCalls: assistantMessage.tool_calls,
      finishReason: choice.finish_reason,
    };
  }
}

export const modelClient: ModelClient = new DefaultModelClient();
