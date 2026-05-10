/**
 * 流式 MCP 客户端
 *
 * 在单次 SSE 连接中解析模型响应里的 <call> 标签并同步执行 handler，
 * 不依赖外部 Conversation 类，避免递归 HTTP 请求。
 */

import { createLogger } from '@/lib/api-station/logger';
import type { McpToolDefinition, McpInvokeContext } from './types';

const logger = createLogger('StreamingMCP');

export interface ToolCallEvent {
  type: 'tool.calling' | 'tool';
  callId: string;
  name: string;
  params: Record<string, unknown>;
  raw?: string | null;
  result?: {
    ok: boolean;
    data?: unknown;
    error?: string;
    terminate?: boolean;
  };
}

export type StreamEvent =
  | { type: 'assistant'; content: string }
  | { type: 'error'; content: string }
  | ToolCallEvent;

export type ToolActionCallback = (params: Record<string, unknown>) => Promise<{
  ok: boolean;
  data?: unknown;
  error?: string;
  message?: string;
  terminate?: boolean;
}>;

type LLMCallback = (messages: Array<{ role: string; content: unknown }>) => Promise<Response>;

export class StreamingMCPClient {
  private tools: Map<string, McpToolDefinition> = new Map();
  private collectedData: Record<string, unknown[]> = {};
  private readonly functionTag = 'call';
  private readonly resultTag = 'rs';
  private functionStartRegex: RegExp;
  private functionEndRegex: RegExp;
  private shouldTerminate: boolean = false;
  private invokeContext: McpInvokeContext = { source: 'analysis-workflow' };

  constructor() {
    this.functionStartRegex = new RegExp(
      `<${this.functionTag}\\s+([a-zA-Z0-9_]+)\\s*>`,
      ''
    );
    this.functionEndRegex = new RegExp(
      `<\\/${this.functionTag}>`,
      'i'
    );
  }

  setContext(context: Partial<McpInvokeContext>): void {
    this.invokeContext = { ...this.invokeContext, ...context };
  }

  registerTool(tool: McpToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  registerTools(tools: McpToolDefinition[]): void {
    for (const tool of tools) {
      this.registerTool(tool);
    }
  }

  getCollectedData(): Record<string, unknown[]> {
    return this.collectedData;
  }

  reset(): void {
    this.collectedData = {};
    this.shouldTerminate = false;
  }

  /**
   * 对工具 handler 做运行时安全隔离：
   * 异常转错误结果 + 30 秒超时保护，防止模块实现的 handler 拖垮整个流。
   */
  private async executeTool(
    name: string,
    params: Record<string, unknown>,
    raw: string | null
  ): Promise<{ ok: boolean; data?: unknown; error?: string; terminate?: boolean }> {
    const tool = this.tools.get(name);
    if (!tool) {
      logger.warn('Tool not found', { toolName: name });
      return { ok: false, error: `Tool '${name}' not found` };
    }

    try {
      const TOOL_TIMEOUT_MS = 30000;

      const result = await Promise.race([
        tool.handler(params, this.invokeContext),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Tool '${name}' execution timeout after ${TOOL_TIMEOUT_MS}ms`)),
            TOOL_TIMEOUT_MS
          )
        ),
      ]);

      if (result && typeof result === 'object') {
        const typedResult = result as { ok?: boolean; data?: unknown; terminate?: boolean };
        if (typedResult.ok === true && typedResult.data !== undefined) {
          if (!this.collectedData[name]) {
            this.collectedData[name] = [];
          }
          this.collectedData[name].push(typedResult.data);
        }

        if (typedResult.terminate === true) {
          this.shouldTerminate = true;
        }
      }

      return result as { ok: boolean; data?: unknown; error?: string; terminate?: boolean };
    } catch (error) {
      logger.error('Tool execution failed', error, { toolName: name });
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async *processSSEStream(response: Response): AsyncGenerator<StreamEvent> {
    if (!response.body) {
      throw new Error('Response body is null');
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
            if (data === '[DONE]') continue;

            let textChunk: string | undefined;
            try {
              const parsed = JSON.parse(data);
              textChunk = parsed.choices?.[0]?.delta?.content;
            } catch {
              textChunk = data;
            }

            if (textChunk) {
              yield* this.processTextChunk(textChunk);
            }
          }
        }
      }

      if (buffer) {
        if (buffer.startsWith('data:')) {
          const data = buffer.substring(5).trim();
          if (data !== '[DONE]') {
            try {
              const parsed = JSON.parse(data);
              const textChunk = parsed.choices?.[0]?.delta?.content;
              if (textChunk) {
                yield* this.processTextChunk(textChunk);
              }
            } catch {
              // ignore trailing parse errors
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private textBuffer = '';
  private generatingTool: {
    callId: string;
    name: string;
    params: Record<string, unknown>;
    raw: string;
    startTagContent: string;
  } | null = null;

  private generateCallId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 9);
    return `call_${timestamp}_${random}`;
  }

  private async *processTextChunk(chunk: string): AsyncGenerator<StreamEvent> {
    this.textBuffer += chunk;

    if (this.generatingTool) {
      const endMatch = this.textBuffer.match(this.functionEndRegex);

      if (endMatch) {
        const endIndex = endMatch.index!;
        const startTagEndIndex = this.textBuffer.indexOf(this.generatingTool.startTagContent) +
                                 this.generatingTool.startTagContent.length;

        if (endIndex >= 0 && endIndex > startTagEndIndex) {
          const rawContent = this.textBuffer.substring(startTagEndIndex, endIndex).trim();
          this.generatingTool.raw = rawContent;

          try {
            this.generatingTool.params = JSON.parse(rawContent);
          } catch (e) {
            logger.warn('Failed to parse JSON params', {
              toolName: this.generatingTool.name,
              rawLength: rawContent.length,
            });
            this.generatingTool.params = {};
          }
        }

        yield {
          type: 'tool.calling',
          callId: this.generatingTool.callId,
          name: this.generatingTool.name,
          params: this.generatingTool.params,
          raw: this.generatingTool.raw || null,
        };

        const result = await this.executeTool(
          this.generatingTool.name,
          this.generatingTool.params,
          this.generatingTool.raw || null
        );

        yield {
          type: 'tool',
          callId: this.generatingTool.callId,
          name: this.generatingTool.name,
          params: this.generatingTool.params,
          raw: this.generatingTool.raw || null,
          result,
        };

        this.textBuffer = this.textBuffer.substring(endIndex + endMatch[0]!.length);
        this.generatingTool = null;

        if (this.textBuffer && !this.shouldTerminate) {
          yield* this.processTextChunk('');
        }
      } else {
        const startTagIndex = this.textBuffer.indexOf(this.generatingTool.startTagContent);
        if (startTagIndex === 0) {
          const potentialRaw = this.textBuffer.substring(this.generatingTool.startTagContent.length);
          if (potentialRaw.length > this.generatingTool.raw.length) {
            this.generatingTool.raw = potentialRaw;
          }
        }
      }
    } else {
      const startMatch = this.textBuffer.match(this.functionStartRegex);

      if (startMatch) {
        const startIndex = startMatch.index!;
        const fullStartTag = startMatch[0]!;
        const toolName = startMatch[1]!;

        if (startIndex > 0) {
          const precedingText = this.textBuffer.substring(0, startIndex);
          if (precedingText) {
            yield { type: 'assistant', content: precedingText };
          }
        }

        this.generatingTool = {
          callId: this.generateCallId(),
          name: toolName,
          params: {},
          raw: '',
          startTagContent: fullStartTag,
        };

        this.textBuffer = this.textBuffer.substring(startIndex);

        const contentAfterStartTag = this.textBuffer.substring(fullStartTag.length);
        const endMatchImmediate = contentAfterStartTag.match(this.functionEndRegex);

        if (endMatchImmediate) {
          const rawContent = contentAfterStartTag.substring(0, endMatchImmediate.index!).trim();
          this.generatingTool.raw = rawContent;

          try {
            this.generatingTool.params = JSON.parse(rawContent);
          } catch (e) {
            logger.warn('Failed to parse JSON params', {
              toolName,
              rawLength: rawContent.length,
            });
          }

          yield {
            type: 'tool.calling',
            callId: this.generatingTool.callId,
            name: this.generatingTool.name,
            params: this.generatingTool.params,
            raw: this.generatingTool.raw || null,
          };

          const result = await this.executeTool(
            this.generatingTool.name,
            this.generatingTool.params,
            this.generatingTool.raw || null
          );

          yield {
            type: 'tool',
            callId: this.generatingTool.callId,
            name: this.generatingTool.name,
            params: this.generatingTool.params,
            raw: this.generatingTool.raw || null,
            result,
          };

          this.textBuffer = contentAfterStartTag.substring(
            endMatchImmediate.index! + endMatchImmediate[0]!.length
          );
          this.generatingTool = null;

          if (this.textBuffer && !this.shouldTerminate) {
            yield* this.processTextChunk('');
          }
        }
      } else {
        const lastLtIndex = this.textBuffer.lastIndexOf('<');
        if (lastLtIndex !== -1) {
          const textToYield = this.textBuffer.substring(0, lastLtIndex);
          if (textToYield) {
            yield { type: 'assistant', content: textToYield };
          }
          this.textBuffer = this.textBuffer.substring(lastLtIndex);
        } else {
          if (this.textBuffer) {
            yield { type: 'assistant', content: this.textBuffer };
            this.textBuffer = '';
          }
        }
      }
    }
  }

  async *stream(
    llmCallback: (messages: Array<{ role: string; content: unknown }>) => Promise<Response>,
    messages: Array<{ role: string; content: unknown }>,
    systemPrompt?: string
  ): AsyncGenerator<StreamEvent> {
    this.textBuffer = '';
    this.generatingTool = null;
    this.shouldTerminate = false;

    const hasSystemMessage = messages.some(m => m.role === 'system');

    let fullMessages: Array<{ role: string; content: unknown }>;

    if (hasSystemMessage) {
      fullMessages = messages;
    } else {
      fullMessages = [
        {
          role: 'system',
          content: systemPrompt || '',
        },
        ...messages,
      ];
    }

    const response = await llmCallback(fullMessages);

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error('API request failed', undefined, {
        status: response.status,
        errorLength: errorBody.length,
      });
      yield {
        type: 'error',
        content: `API Error (${response.status}): ${errorBody}`,
      };
      return;
    }

    yield* this.processSSEStream(response);

    if (this.textBuffer) {
      const toolInfo = this.getGeneratingToolInfo();
      if (toolInfo) {
        logger.warn('Stream ended mid-tool-call', {
          toolName: toolInfo.name,
          callId: toolInfo.callId,
        });
        const incompleteText = toolInfo.startTagContent + toolInfo.raw;
        if (incompleteText) {
          yield { type: 'assistant', content: incompleteText };
        }
      } else {
        yield { type: 'assistant', content: this.textBuffer };
      }
    }
  }

  private getGeneratingToolInfo(): {
    callId: string;
    name: string;
    raw: string;
    startTagContent: string;
  } | null {
    return this.generatingTool;
  }
}
