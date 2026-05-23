/**
 * 流式 MCP 适配器
 *
 * 依赖 modelClient 获取流式文本，基于 StreamingMCPClient 解析 <call> 标签、
 * 执行工具并分发事件。HTTP 请求由 modelClient 负责，Adapter 不触碰网络。
 */

import { StreamingMCPClient, type StreamEvent } from './streamingClient';
import type { McpToolDefinition } from './types';
import type { ModelAnalysisRequest } from '@/types/analysis';
import type { AnalysisEventHandlers } from '@/types/streamEvents';
import { createLogger } from '@/lib/api-station/logger';
import { modelClient } from '@/services/model-client';

const logger = createLogger('StreamingMCPAdapter');

export class StreamingMCPAdapter {
  private client: StreamingMCPClient;
  private eventHandlers: AnalysisEventHandlers;
  private capturedToolCall: {
    name: string;
    params: Record<string, unknown>;
  } | null = null;
  private collectedData: Record<string, unknown[]> = {};
  private model: string;
  private temperature?: number;

  constructor(
    model: string,
    temperature?: number,
    eventHandlers?: AnalysisEventHandlers,
    mcpToolDefinitions?: McpToolDefinition[],
  ) {
    if (!model || typeof model !== 'string') {
      throw new Error('StreamingMCPAdapter: model 不能为空');
    }

    this.model = model;
    this.temperature = temperature;
    this.eventHandlers = eventHandlers || {};

    this.client = new StreamingMCPClient();

    const tools = mcpToolDefinitions ?? [];
    logger.debug('注册工具', { tools: tools.map(t => t.name) });
    this.client.registerTools(tools);
  }

  /**
   * 发送消息并处理流式响应。
   *
   * 通过 modelClient.chatStream() 获取文本流，
   * 交由 StreamingMCPClient.processStream() 解析 <call> 标签。
   */
  async sendMessage(payload: ModelAnalysisRequest): Promise<{
    fullContent: string;
    toolCall: { name: string; params: Record<string, unknown> } | null;
    /** 流结束且已收集数据但无显式终止——由调用方触发 assemble */
    autoFinalized: boolean;
    /** 收集的数据（toolName → 调用结果数组） */
    collectedData: Record<string, unknown[]>;
  }> {
    this.client.reset();
    this.capturedToolCall = null;
    this.collectedData = {};

    let fullContent = '';
    let hasEmittedFirstToken = false;
    let hasEmittedThinkStart = false;
    let hasEmittedContentStart = false;

    // 从 modelClient 获取文本流（modelClient 需由调用方预先 configure）
    const chunks = modelClient.chatStream({
      model: this.model,
      messages: payload.messages,
      temperature: this.temperature,
    });

    const events = this.client.processStream(chunks);

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
              
              // 将收集的数据合并到 params 中，支持 finalize_report 场景
              const mergedParams = Object.keys(this.collectedData).length > 0
                ? { ...toolEvent.params, ...this.collectedData }
                : toolEvent.params;
              
              this.capturedToolCall = {
                name: toolEvent.name,
                params: mergedParams,
              };
              
              if (Object.keys(this.collectedData).length > 0) {
                logger.debug('数据已合并到终止工具调用', { 
                  toolName: toolEvent.name,
                  collectedKeys: Object.keys(this.collectedData),
                });
              }
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

    // 流结束且无显式终止时，若已收集数据则标记 autoFinalized
    const autoFinalized = !this.capturedToolCall && Object.keys(this.collectedData).length > 0;
    if (autoFinalized) {
      logger.info('流结束，自动完成数据收集', { tools: Object.keys(this.collectedData) });
    }

    return {
      fullContent,
      toolCall: this.capturedToolCall,
      autoFinalized,
      collectedData: this.collectedData,
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
