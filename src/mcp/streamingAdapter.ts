/**
 * 流式 MCP 适配器
 *
 * 使用自定义的 StreamingMCPClient 实现流式 MCP 调用
 * 
 * 与原 ConversationAdapter 的区别：
 * - 不使用 @obayd/agentic 的 Conversation 类
 * - 工具调用后不会发起新的 HTTP 请求
 * - 所有工具调用在单次流中完成
 * - 工具定义由输出模式模块提供
 * 
 * 架构说明：
 * - 业务工具由各输出模式模块自行定义并提供
 * - 框架层仅提供 abort_workflow 工具作为兜底
 */

import { StreamingMCPClient, type StreamEvent } from './streamingClient';
import type { McpToolDefinition } from './types';
import { abortWorkflowTool } from './tools/abortWorkflow';
import { requestJson, requestResponse } from '@/lib/client-request';
import type { CollectedToolData } from '@/server/output-modes/types';
import type { ModelAnalysisRequest } from '@/types/analysis';
import type { AnalysisEventHandlers } from '@/types/streamEvents';
import { createAppError } from '@/types/errors';

/**
 * 流式 MCP 适配器
 *
 * 使用 StreamingMCPClient 处理流式响应和工具调用
 * - 如果提供了 baseUrl 和 apiKey，直接调用自定义端点
 * - 否则使用站内代理服务 /api/v1/chat/completions
 *
 * 支持多工具分阶段收集模式
 */
export class StreamingMCPAdapter {
  private client: StreamingMCPClient;
  private eventHandlers: AnalysisEventHandlers;
  private capturedToolCall: {
    name: string;
    params: Record<string, unknown>;
  } | null = null;
  /** 多工具收集模式：收集的数据 */
  private collectedData: Record<string, unknown[]> = {};
  private cachedProxyKey: string | null = null;
  private model: string;
  private temperature?: number;
  /** 自定义 API 端点（可选） */
  private baseUrl?: string;
  /** 自定义 API Key（可选） */
  private apiKey?: string;

  constructor(
    model: string,
    temperature?: number,
    eventHandlers?: AnalysisEventHandlers,
    mcpToolDefinitions?: McpToolDefinition[],
    baseUrl?: string,
    apiKey?: string
  ) {
    // 参数验证
    if (!model || typeof model !== 'string') {
      throw new Error('StreamingMCPAdapter: model 不能为空');
    }

    this.model = model;
    this.temperature = temperature;
    this.eventHandlers = eventHandlers || {};
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;

    // 创建 StreamingMCPClient
    this.client = new StreamingMCPClient();

    // 注册工具定义
    // 架构原则：工具定义由输出模式模块提供
    // - 如果模块提供了工具定义，使用模块的（应已包含 abort_workflow）
    // - 如果模块未提供工具定义，使用框架层的 abort_workflow 作为兜底
    const tools = mcpToolDefinitions && mcpToolDefinitions.length > 0
      ? mcpToolDefinitions
      : [abortWorkflowTool];

    console.log('[StreamingMCPAdapter] 注册工具:', tools.map(t => t.name));
    this.client.registerTools(tools);
    console.log('[StreamingMCPAdapter] 工具注册完成');
    console.log('[StreamingMCPAdapter] 配置:', {
      hasCustomEndpoint: !!baseUrl,
      endpoint: baseUrl || '/api/v1/chat/completions (站内代理)'
    });
  }

  /**
   * 获取或创建 proxy key
   */
  private async getProxyKey(): Promise<string> {
    if (this.cachedProxyKey) {
      return this.cachedProxyKey;
    }

    const keyData = await requestJson<{ key?: string; error?: { message?: string } }>('/api/v1/key', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'same-origin',
      body: JSON.stringify({}),
      errorMessage: '获取站内代理凭证失败',
      networkErrorMessage: '获取站内代理凭证失败，请检查网络后重试',
    });

    if (!keyData.key) {
      throw createAppError({
        code: 'provider_request_failed',
        message: keyData.error?.message || '获取站内代理凭证失败',
        retryable: true,
      });
    }

    this.cachedProxyKey = keyData.key;
    return keyData.key;
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

    // 传递完整的消息（包括系统消息）
    // StreamingMCPClient 会检测是否已有系统消息
    const events = this.client.stream(
      llmCallback,
      payload.messages,
      // 不传递额外的系统提示词，因为消息中已包含
      undefined
    );

    try {
      for await (const event of events) {
        // 调试日志
        console.log('[StreamingMCP] Event:', event.type, 'name' in event ? (event as { name?: string }).name : '');

        switch (event.type) {
          case 'assistant':
            // 文本内容
            fullContent += event.content;

            // 触发 first-token 事件
            if (!hasEmittedFirstToken && event.content.trim().length > 0) {
              this.eventHandlers.onFirstToken?.({
                type: 'first-token',
                timestamp: Date.now(),
              });
              hasEmittedFirstToken = true;
            }

            // 触发 think-start 事件
            if (!hasEmittedThinkStart && fullContent.trim().length > 0) {
              this.eventHandlers.onThinkStart?.({
                type: 'think-start',
                timestamp: Date.now(),
              });
              hasEmittedThinkStart = true;
            }

            // 触发 content-start 事件
            if (!hasEmittedContentStart && fullContent.trim().length > 0) {
              this.eventHandlers.onContentStart?.({
                type: 'content-start',
                timestamp: Date.now(),
              });
              hasEmittedContentStart = true;
            }
            break;

          case 'tool.generating':
            // 工具调用生成中
            console.log('[Tool Generating]:', (event as { name: string }).name, (event as { raw?: string }).raw);
            break;

          case 'tool.calling':
            // 工具调用发生
            console.log('[Tool Calling]:', (event as { name: string }).name, 'params:', JSON.stringify((event as { params: Record<string, unknown> }).params).slice(0, 200));
            break;

          case 'tool':
            // 工具结果返回
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
            console.log('[Tool Result]:', toolEvent.name, 'ok:', toolEvent.result?.ok, 'terminate:', toolEvent.result?.terminate);

            // 收集工具数据
            if (toolEvent.result?.ok === true && toolEvent.result?.data) {
              if (!this.collectedData[toolEvent.name]) {
                this.collectedData[toolEvent.name] = [];
              }
              this.collectedData[toolEvent.name].push(toolEvent.result.data);
              console.log('[Tool Result] 数据已收集:', toolEvent.name, '当前收集:', 
                Object.keys(this.collectedData).map(k => `${k}(${this.collectedData[k].length})`).join(', ')
              );
            }

            // 检查是否需要终止
            if (toolEvent.result?.terminate === true) {
              if (toolEvent.name === 'finalize_report') {
                console.log('[Tool Result] finalize_report 触发，工作流结束');
                this.capturedToolCall = {
                  name: 'multi_collect_complete',
                  params: this.collectedData,
                };
              } else if (toolEvent.name === 'abort_workflow') {
                console.log('[Tool Result] abort_workflow 触发');
                this.capturedToolCall = {
                  name: toolEvent.name,
                  params: toolEvent.result.data as Record<string, unknown>,
                };
              }
            }

            // 如果工具返回错误，让模型重试
            if (toolEvent.result?.ok === false) {
              console.log('[Tool Result] 验证失败:', toolEvent.result.error);
            }
            break;

          case 'error':
            console.error('[StreamingMCP Error]:', (event as { content: string }).content);
            break;
        }
      }
    } catch (error) {
      console.error('[StreamingMCP] Stream error:', error);
      throw error;
    }

    // 流结束后，如果没有显式终止但收集了数据，自动完成
    if (!this.capturedToolCall && Object.keys(this.collectedData).length > 0) {
      console.log('[StreamingMCP] 流结束，自动完成数据收集:', Object.keys(this.collectedData));
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

  /**
   * 获取捕获的工具调用
   */
  getCapturedToolCall() {
    return this.capturedToolCall;
  }

  /**
   * 重置适配器状态
   */
  reset() {
    this.capturedToolCall = null;
    this.collectedData = {};
    this.client.reset();
  }
}

/**
 * 创建流式 MCP 适配器
 *
 * 工厂函数，便于创建适配器实例
 */
export function createStreamingMCPAdapter(
  model: string,
  temperature?: number,
  eventHandlers?: AnalysisEventHandlers
): StreamingMCPAdapter {
  return new StreamingMCPAdapter(model, temperature, eventHandlers);
}
