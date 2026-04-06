import type { AnalysisEventHandlers } from '@/types/streamEvents';
import { StreamingMCPAdapter } from '@/mcp/streamingAdapter';
import type { ModelAnalysisRequest } from '@/types/analysis';
import type { ModelClient, ModelClientOptions, ModelClientResult } from './types';

export type { ModelClient, ModelClientOptions, ModelClientResult };

/**
 * 默认 ModelClient 实现
 *
 * 基于 StreamingMCPAdapter，提供简洁的 API 调用接口
 * 支持流式响应和工具调用自动捕获
 * 
 * 注意：不使用 @obayd/agentic 的 Conversation 类，因为它会在工具调用后自动发起新请求
 */
class DefaultModelClient implements ModelClient {
  async call(options: ModelClientOptions): Promise<ModelClientResult> {
    const { baseUrl, apiKey, model, messages, temperature, events, mcpToolDefinitions } = options;

    const payload: ModelAnalysisRequest = {
      model,
      messages,
      temperature,
    };

    // 使用 StreamingMCPAdapter
    // 传递 baseUrl 和 apiKey，支持自定义端点
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
      toolCall: result.toolCall, // 返回捕获的工具调用
    };
  }
}

/**
 * 默认导出的 ModelClient 实例
 */
export const modelClient: ModelClient = new DefaultModelClient();
