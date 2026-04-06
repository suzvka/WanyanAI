/**
 * 流式 MCP 客户端
 *
 * 设计目标：
 * 1. 保持单次 HTTP 连接，不触发递归请求
 * 2. 在流中处理所有工具调用
 * 3. 工具数据收集后继续等待更多内容
 * 4. 流结束后返回所有收集的数据
 *
 * 不依赖 @obayd/agentic，直接使用 McpToolDefinition
 */

import type { McpToolDefinition, McpInvokeContext } from './types';

/** 工具调用事件 */
export interface ToolCallEvent {
  type: 'tool.generating' | 'tool.calling' | 'tool';
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

/** 流式事件 */
export type StreamEvent =
  | { type: 'assistant'; content: string }
  | { type: 'error'; content: string }
  | ToolCallEvent;

/** 工具 Action 回调类型 */
export type ToolActionCallback = (params: Record<string, unknown>) => Promise<{
  ok: boolean;
  data?: unknown;
  error?: string;
  message?: string;
  terminate?: boolean;
}>;

/** LLM 回调类型 - 返回 SSE 流 */
type LLMCallback = (messages: Array<{ role: string; content: unknown }>) => Promise<Response>;

/**
 * 流式 MCP 客户端
 *
 * 使用示例：
 * ```typescript
 * const client = new StreamingMCPClient(llmCallback);
 * client.registerTool(collectSummaryTool);
 * 
 * for await (const event of client.stream(messages)) {
 *   if (event.type === 'tool') {
 *     // 处理工具调用结果
 *   }
 * }
 * 
 * const collectedData = client.getCollectedData();
 * ```
 */
export class StreamingMCPClient {
  private tools: Map<string, McpToolDefinition> = new Map();
  private collectedData: Record<string, unknown[]> = {};
  /** 工具调用标签（使用 'call' 格式，与提示词一致） */
  private readonly functionTag = 'call';
  /** 结果标签 */
  private readonly resultTag = 'rs';
  /** 工具调用开始正则：匹配 <call tool_name> */
  private functionStartRegex: RegExp;
  /** 工具调用结束正则：匹配 </call> */
  private functionEndRegex: RegExp;
  private shouldTerminate: boolean = false;
  /** 调用上下文 */
  private invokeContext: McpInvokeContext = { source: 'analysis-workflow' };

  constructor() {
    // 使用与提示词一致的标签格式
    // <call tool_name> ... </call>
    this.functionStartRegex = new RegExp(
      `<${this.functionTag}\\s+([a-zA-Z0-9_]+)\\s*>`,
      ''
    );
    this.functionEndRegex = new RegExp(
      `<\\/${this.functionTag}>`,
      'i'
    );
  }

  /**
   * 设置调用上下文
   */
  setContext(context: Partial<McpInvokeContext>): void {
    this.invokeContext = { ...this.invokeContext, ...context };
  }

  /**
   * 注册工具
   */
  registerTool(tool: McpToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * 批量注册工具
   */
  registerTools(tools: McpToolDefinition[]): void {
    for (const tool of tools) {
      this.registerTool(tool);
    }
  }

  /**
   * 获取收集的数据
   */
  getCollectedData(): Record<string, unknown[]> {
    return this.collectedData;
  }

  /**
   * 重置收集的数据
   */
  reset(): void {
    this.collectedData = {};
    this.shouldTerminate = false;
  }

  /**
   * 构建系统提示词（包含工具定义）
   * 
   * 注意：现在直接返回空字符串，因为工具定义由 /api/mcp/compile 提供
   * 并嵌入到模板的系统消息中
   */
  private buildSystemPrompt(): string {
    // 工具定义由外部提示词提供，这里不再生成
    return '';
  }

  /**
   * 执行工具调用
   */
  private async executeTool(
    name: string,
    params: Record<string, unknown>,
    raw: string | null
  ): Promise<{ ok: boolean; data?: unknown; error?: string; terminate?: boolean }> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { ok: false, error: `Tool '${name}' not found` };
    }

    try {
      // 直接调用工具的 handler
      const result = await tool.handler(params, this.invokeContext);
      
      // 收集成功的工具数据
      if (result && typeof result === 'object') {
        const typedResult = result as { ok?: boolean; data?: unknown; terminate?: boolean };
        if (typedResult.ok === true && typedResult.data !== undefined) {
          if (!this.collectedData[name]) {
            this.collectedData[name] = [];
          }
          this.collectedData[name].push(typedResult.data);
        }
        
        // 检查是否需要终止
        if (typedResult.terminate === true) {
          this.shouldTerminate = true;
        }
      }

      return result as { ok: boolean; data?: unknown; error?: string; terminate?: boolean };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 流式处理 SSE 响应
   *
   * @param response - fetch Response 对象
   * @yields 流式事件
   */
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
              // 如果不是 JSON，直接使用原始数据
              textChunk = data;
            }

            if (textChunk) {
              // 处理文本块，提取工具调用
              yield* this.processTextChunk(textChunk);
            }
          }
        }
      }

      // 处理剩余的缓冲区
      if (buffer) {
        // 尝试解析最后的数据
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
              // 忽略解析错误
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * 处理文本块，提取工具调用
   * 
   * 支持的格式：
   * <call tool_name>
   * { "param1": "value1", "param2": "value2" }
   * </call>
   */
  private textBuffer = '';
  private generatingTool: {
    callId: string;
    name: string;
    params: Record<string, unknown>;
    raw: string;
    startTagContent: string;
  } | null = null;

  /** 生成唯一的调用 ID */
  private generateCallId(): string {
    return `call_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private async *processTextChunk(chunk: string): AsyncGenerator<StreamEvent> {
    this.textBuffer += chunk;

    // 如果正在生成工具调用
    if (this.generatingTool) {
      const endMatch = this.textBuffer.match(this.functionEndRegex);

      if (endMatch) {
        // 找到结束标签
        const endIndex = endMatch.index!;
        const startTagEndIndex = this.textBuffer.indexOf(this.generatingTool.startTagContent) + 
                                 this.generatingTool.startTagContent.length;

        // 提取 raw 内容（JSON 参数）
        if (endIndex >= 0 && endIndex > startTagEndIndex) {
          const rawContent = this.textBuffer.substring(startTagEndIndex, endIndex).trim();
          this.generatingTool.raw = rawContent;
          
          // 尝试解析 JSON 参数
          try {
            this.generatingTool.params = JSON.parse(rawContent);
          } catch (e) {
            console.warn(`[StreamingMCP] Failed to parse JSON params for ${this.generatingTool.name}:`, rawContent);
            // 解析失败时使用空对象
            this.generatingTool.params = {};
          }
        }

        // 发出 tool.calling 事件
        yield {
          type: 'tool.calling',
          callId: this.generatingTool.callId,
          name: this.generatingTool.name,
          params: this.generatingTool.params,
          raw: this.generatingTool.raw || null,
        };

        // 执行工具
        const result = await this.executeTool(
          this.generatingTool.name,
          this.generatingTool.params,
          this.generatingTool.raw || null
        );

        // 发出 tool 事件（包含结果）
        yield {
          type: 'tool',
          callId: this.generatingTool.callId,
          name: this.generatingTool.name,
          params: this.generatingTool.params,
          raw: this.generatingTool.raw || null,
          result,
        };

        // 更新缓冲区，移除已处理的工具调用
        this.textBuffer = this.textBuffer.substring(endIndex + endMatch[0]!.length);
        this.generatingTool = null;

        // 继续处理剩余缓冲区（可能还有更多工具调用或文本）
        if (this.textBuffer && !this.shouldTerminate) {
          yield* this.processTextChunk('');
        }
      } else {
        // 还没有找到结束标签，检查是否有更多 raw 内容
        const startTagIndex = this.textBuffer.indexOf(this.generatingTool.startTagContent);
        if (startTagIndex === 0) {
          const potentialRaw = this.textBuffer.substring(this.generatingTool.startTagContent.length);
          if (potentialRaw.length > this.generatingTool.raw.length) {
            // 尝试解析部分 JSON（用于调试）
            this.generatingTool.raw = potentialRaw;
            
            // 不发出 generating 事件，因为 JSON 是整体解析的
          }
        }
      }
    } else {
      // 没有正在生成的工具调用，检查是否有新的工具调用开始
      const startMatch = this.textBuffer.match(this.functionStartRegex);

      if (startMatch) {
        const startIndex = startMatch.index!;
        const fullStartTag = startMatch[0]!;
        const toolName = startMatch[1]!;  // 新格式：<call tool_name>，工具名是第一个捕获组

        // 先发出前面的文本内容
        if (startIndex > 0) {
          const precedingText = this.textBuffer.substring(0, startIndex);
          if (precedingText) {
            yield { type: 'assistant', content: precedingText };
          }
        }

        // 开始新的工具调用
        this.generatingTool = {
          callId: this.generateCallId(),
          name: toolName,
          params: {},  // 参数将从 JSON 内容中解析
          raw: '',
          startTagContent: fullStartTag,
        };

        // 更新缓冲区
        this.textBuffer = this.textBuffer.substring(startIndex);

        // 检查结束标签是否已经在缓冲区中
        const contentAfterStartTag = this.textBuffer.substring(fullStartTag.length);
        const endMatchImmediate = contentAfterStartTag.match(this.functionEndRegex);

        if (endMatchImmediate) {
          // 完整的工具调用已在缓冲区中
          const rawContent = contentAfterStartTag.substring(0, endMatchImmediate.index!).trim();
          this.generatingTool.raw = rawContent;
          
          // 解析 JSON 参数
          try {
            this.generatingTool.params = JSON.parse(rawContent);
          } catch (e) {
            console.warn(`[StreamingMCP] Failed to parse JSON params for ${toolName}:`, rawContent);
          }

          // 发出 tool.calling 事件
          yield {
            type: 'tool.calling',
            callId: this.generatingTool.callId,
            name: this.generatingTool.name,
            params: this.generatingTool.params,
            raw: this.generatingTool.raw || null,
          };

          // 执行工具
          const result = await this.executeTool(
            this.generatingTool.name,
            this.generatingTool.params,
            this.generatingTool.raw || null
          );

          // 发出 tool 事件
          yield {
            type: 'tool',
            callId: this.generatingTool.callId,
            name: this.generatingTool.name,
            params: this.generatingTool.params,
            raw: this.generatingTool.raw || null,
            result,
          };

          // 更新缓冲区
          this.textBuffer = contentAfterStartTag.substring(
            endMatchImmediate.index! + endMatchImmediate[0]!.length
          );
          this.generatingTool = null;

          // 继续处理剩余缓冲区
          if (this.textBuffer && !this.shouldTerminate) {
            yield* this.processTextChunk('');
          }
        }
        // 如果结束标签还没到，等待更多数据
      } else {
        // 没有找到工具调用开始标签
        // 为避免部分标签被提前发出，只发出到最后一个 '<' 之前的内容
        const lastLtIndex = this.textBuffer.lastIndexOf('<');
        if (lastLtIndex !== -1) {
          const textToYield = this.textBuffer.substring(0, lastLtIndex);
          if (textToYield) {
            yield { type: 'assistant', content: textToYield };
          }
          this.textBuffer = this.textBuffer.substring(lastLtIndex);
        } else {
          // 没有 '<'，整个缓冲区都是文本
          if (this.textBuffer) {
            yield { type: 'assistant', content: this.textBuffer };
            this.textBuffer = '';
          }
        }
      }
    }
  }

  /**
   * 流式发送消息并处理响应
   *
   * @param llmCallback - LLM 请求回调，返回 Response 对象
   * @param messages - 消息历史（可以包含系统消息）
   * @param systemPrompt - 可选的系统提示词前缀（当消息中没有系统消息时使用）
   * @yields 流式事件
   */
  async *stream(
    llmCallback: (messages: Array<{ role: string; content: unknown }>) => Promise<Response>,
    messages: Array<{ role: string; content: unknown }>,
    systemPrompt?: string
  ): AsyncGenerator<StreamEvent> {
    // 重置状态
    this.textBuffer = '';
    this.generatingTool = null;
    this.shouldTerminate = false;

    // 检查消息中是否已有系统消息
    const hasSystemMessage = messages.some(m => m.role === 'system');
    
    let fullMessages: Array<{ role: string; content: unknown }>;
    
    if (hasSystemMessage) {
      // 如果已有系统消息，直接使用（假设已包含工具定义）
      fullMessages = messages;
    } else {
      // 如果没有系统消息，创建一个包含工具定义的系统消息
      fullMessages = [
        {
          role: 'system',
          content: (systemPrompt || '') + this.buildSystemPrompt(),
        },
        ...messages,
      ];
    }

    // 发起请求
    const response = await llmCallback(fullMessages);

    if (!response.ok) {
      const errorBody = await response.text();
      yield {
        type: 'error',
        content: `API Error (${response.status}): ${errorBody}`,
      };
      return;
    }

    // 处理 SSE 流
    yield* this.processSSEStream(response);

    // 处理流结束后的剩余缓冲区
    if (this.textBuffer) {
      // 如果还在生成工具调用，说明流被中断
      // 注意：使用 getter 方法避免 TypeScript 控制流分析问题
      const toolInfo = this.getGeneratingToolInfo();
      if (toolInfo) {
        console.warn(
          `Stream ended mid-tool-call for ${toolInfo.name}(${toolInfo.callId})`
        );
        // 发出未完成的标签作为文本
        const incompleteText = toolInfo.startTagContent + toolInfo.raw;
        if (incompleteText) {
          yield { type: 'assistant', content: incompleteText };
        }
      } else {
        // 发出剩余的文本
        yield { type: 'assistant', content: this.textBuffer };
      }
    }
  }

  /**
   * 获取当前生成中的工具调用信息
   * 用于避免 TypeScript 控制流分析问题
   */
  private getGeneratingToolInfo(): {
    callId: string;
    name: string;
    raw: string;
    startTagContent: string;
  } | null {
    return this.generatingTool;
  }
}
