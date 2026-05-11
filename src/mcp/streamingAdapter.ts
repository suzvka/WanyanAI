/**
 * 流式 MCP 适配器
 *
 * 基于 StreamingMCPClient 封装 LLM 调用，在单次 SSE 流中完成
 * 工具注册、响应解析和事件分发。不感知工具的业务含义。
 */

import { StreamingMCPClient, type StreamEvent } from './streamingClient';
import type { McpToolDefinition } from './types';
import { requestJson, requestResponse } from '@/lib/client-request';
import type { CollectedToolData } from '@/server/output-modes/types';
import type { ModelAnalysisRequest } from '@/types/analysis';
import type { AnalysisEventHandlers } from '@/types/streamEvents';
import { createAppError } from '@/types/errors';
import { createLogger } from '@/lib/api-station/logger';

const logger = createLogger('StreamingMCPAdapter');

export class StreamingMCPAdapter {
  private client: StreamingMCPClient;
  private eventHandlers: AnalysisEventHandlers;
  private capturedToolCall: {
    name: string;
    params: Record<string, unknown>;
  } | null = null;
  private collectedData: Record<string, unknown[]> = {};
  private cachedProxyKey: string | null = null;
  private model: string;
  private temperature?: number;
  private baseUrl?: string;
  private apiKey?: string;

  constructor(
    model: string,
    temperature?: number,
    eventHandlers?: AnalysisEventHandlers,
    mcpToolDefinitions?: McpToolDefinition[],
    baseUrl?: string,
    apiKey?: string
  ) {
    if (!model || typeof model !== 'string') {
      throw new Error('StreamingMCPAdapter: model 不能为空');
    }

    this.model = model;
    this.temperature = temperature;
    this.eventHandlers = eventHandlers || {};
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;

    this.client = new StreamingMCPClient();

    // 工具列表由调用方（框架注册表）组装后传入，Adapter 只做纯执行。
    const tools = mcpToolDefinitions ?? [];

    logger.debug('注册工具', { tools: tools.map(t => t.name) });
    this.client.registerTools(tools);
    logger.info('工具注册完成', { 
      hasCustomEndpoint: !!baseUrl,
      endpoint: baseUrl || '/api/v1/chat/completions (站内代理)'
    });
  }

  /**
   * 获取代理 key
   *
   * 如果认证服务不可用，返回一个临时的游客标识，后续鉴权会降级为游客权限
   */
  private async getProxyKey(): Promise<string> {
    if (this.cachedProxyKey) {
      return this.cachedProxyKey;
    }

    try {
      const keyData = await requestJson<{ key?: string; warning?: string; error?: { message?: string } }>('/api/v1/key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({}),
        errorMessage: '获取站内代理凭证失败',
        networkErrorMessage: '获取站内代理凭证失败，请检查网络后重试',
      });

      if (keyData.key) {
        this.cachedProxyKey = keyData.key;
        return keyData.key;
      }

      // key 为空，可能是认证服务不可用
      if (keyData.warning) {
        logger.warn('认证服务不可用，将使用游客权限', { warning: keyData.warning });
      } else if (keyData.error) {
        logger.warn('获取 key 失败，将使用游客权限', { error: keyData.error.message });
      }

      // 返回一个临时的游客标识，后续鉴权会降级为游客权限
      // 使用 'guest_local_' 前缀标识这是本地生成的临时标识
      const guestKey = `guest_local_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      this.cachedProxyKey = guestKey;
      return guestKey;
    } catch (error) {
      logger.warn('获取 key 请求失败，将使用游客权限', { error: String(error) });

      // 返回一个临时的游客标识
      const guestKey = `guest_local_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      this.cachedProxyKey = guestKey;
      return guestKey;
    }
  }

  /**
   * 发送消息并处理流式响应
   *
   * @param payload 模型请求参数
   * @returns 完整内容和捕获的工具调用
   */
  async sendMessage(payload: ModelAnalysisRequest): Promise<{
    fullContent: string;
    toolCall: { name: string; params: Record<string, unknown> } | null;
  }> {
    // 重置状态
    this.client.reset();
    this.capturedToolCall = null;
    this.collectedData = {};

    let fullContent = '';
    let hasEmittedFirstToken = false;
    let hasEmittedThinkStart = false;
    let hasEmittedContentStart = false;

    // 创建 LLM 回调函数
    const llmCallback = async (messages: Array<{ role: string; content: unknown }>) => {
      const endpoint = this.baseUrl
        ? `${this.baseUrl.replace(/\/$/, '')}/chat/completions`
        : `/api/v1/chat/completions`;

      const authHeader = this.apiKey
        ? `Bearer ${this.apiKey}`
        : `Bearer ${await this.getProxyKey()}`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      };

      const requestBody: Record<string, unknown> = {
        model: this.model,
        messages,
        stream: true,
      };

      if (this.temperature !== undefined) {
        requestBody.temperature = this.temperature;
      }

      return requestResponse(endpoint, {
        method: 'POST',
        headers,
        credentials: 'same-origin',
        body: JSON.stringify(requestBody),
        errorCode: 'provider_request_failed',
        errorMessage: '模型请求失败',
        networkErrorMessage: '模型请求失败，请检查网络连接或服务配置后重试',
        mapErrorMessage: (message) => (
          message.includes('rate limit exceeded')
            ? '请求过于频繁，请稍后再试（每分钟最多 3 次请求）'
            : message
        ),
      });
    };

    const events = this.client.stream(
      llmCallback,
      payload.messages,
      undefined
    );

    try {
      for await (const event of events) {
        logger.debug('Event', { 
          type: event.type, 
          name: 'name' in event ? (event as { name?: string }).name : undefined 
        });

        switch (event.type) {
          case 'assistant':
            fullContent += event.content;

            if (!hasEmittedFirstToken && event.content.trim().length > 0) {
              this.eventHandlers.onFirstToken?.({
                type: 'first-token',
                timestamp: Date.now(),
              });
              hasEmittedFirstToken = true;
            }

            if (!hasEmittedThinkStart && fullContent.trim().length > 0) {
              this.eventHandlers.onThinkStart?.({
                type: 'think-start',
                timestamp: Date.now(),
              });
              hasEmittedThinkStart = true;
            }

            if (!hasEmittedContentStart && fullContent.trim().length > 0) {
              this.eventHandlers.onContentStart?.({
                type: 'content-start',
                timestamp: Date.now(),
              });
              hasEmittedContentStart = true;
            }
            break;

          case 'tool.calling':
            logger.debug('Tool Calling', { 
              name: (event as { name: string }).name,
              params: JSON.stringify((event as { params: Record<string, unknown> }).params).slice(0, 200)
            });
            break;

          case 'tool': {
            const toolEvent = event as {
              name: string;
              params: Record<string, unknown>;
              result?: {
                ok: boolean;
                data?: unknown;
                error?: string;
                terminate?: boolean;
              };
            };
            logger.debug('Tool Result', { 
              name: toolEvent.name, 
              ok: toolEvent.result?.ok, 
              terminate: toolEvent.result?.terminate 
            });

            if (toolEvent.result?.ok === true && toolEvent.result?.data) {
              if (!this.collectedData[toolEvent.name]) {
                this.collectedData[toolEvent.name] = [];
              }
              this.collectedData[toolEvent.name].push(toolEvent.result.data);
              logger.debug('数据已收集', { 
                tool: toolEvent.name, 
                collected: Object.keys(this.collectedData).map(k => `${k}(${this.collectedData[k].length})`).join(', ')
              });
            }

            // Adapter 只负责捕获原始工具调用，不做业务语义转换。
            // 工具含义由 OutputModeModule.resolveToolCall() 解释。
            if (toolEvent.result?.terminate === true) {
              logger.info('Tool triggered termination', { toolName: toolEvent.name });
              this.capturedToolCall = {
                name: toolEvent.name,
                params: toolEvent.params,
              };
            }

            if (toolEvent.result?.ok === false) {
              logger.warn('工具验证失败', { error: toolEvent.result.error });
            }
            break;
          }

          case 'error':
            logger.error('StreamingMCP Error', { content: (event as { content: string }).content });
            break;
        }
      }
    } catch (error) {
      logger.error('Stream error', error);
      throw error;
    }

    // 流结束且无显式终止时，若已收集数据则自动完成，避免多工具模式下挂起。
    if (!this.capturedToolCall && Object.keys(this.collectedData).length > 0) {
      logger.info('流结束，自动完成数据收集', { tools: Object.keys(this.collectedData) });
      this.capturedToolCall = {
        name: 'multi_collect_complete',
        params: this.collectedData,
      };
    }

    return {
      fullContent,
      toolCall: this.capturedToolCall,
    };
  }

  getCapturedToolCall() {
    return this.capturedToolCall;
  }

  reset() {
    this.capturedToolCall = null;
    this.collectedData = {};
    this.client.reset();
  }
}

export function createStreamingMCPAdapter(
  model: string,
  temperature?: number,
  eventHandlers?: AnalysisEventHandlers
): StreamingMCPAdapter {
  return new StreamingMCPAdapter(model, temperature, eventHandlers);
}
