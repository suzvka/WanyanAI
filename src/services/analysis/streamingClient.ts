import type { AnalysisEvent, AnalysisEventHandlers, ThinkPatternConfig } from '@/types/streamEvents';
import type { ModelAnalysisRequest, RawModelResponse } from '@/types/analysis';
import { AppError, createAppError } from '@/types/errors';

type SSEMessage = {
  id?: string;
  event?: string;
  data: string;
};

type StreamingClientConfig = {
  baseUrl: string;
  apiKey: string;
  payload: ModelAnalysisRequest;
  eventHandlers?: AnalysisEventHandlers;
};

export type StreamingClientResult = {
  response: RawModelResponse;
  events: AnalysisEvent[];
};

/**
 * 默认思考块检测模式
 * 支持多种模型的思考过程输出格式
 */
const DEFAULT_THINK_START_PATTERNS = [
  'Thinking Process:',
  '<think>',
  '【思考】',
  '【思维过程】',
  '### 思考',
  '### 思维过程',
];

const DEFAULT_THINK_END_PATTERNS = [
  '</think>',
  '【/思考】',
  '【/思维过程】',
  '### 分析结果',
  '### 结果',
];

/**
 * 检查字符串是否包含任意模式
 */
function containsPattern(text: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    if (text.includes(pattern)) {
      return true;
    }
  }
  return false;
}

/**
 * 查找模式在字符串中的位置
 */
function findPatternIndex(text: string, patterns: string[]): { index: number; length: number } | null {
  for (const pattern of patterns) {
    const index = text.indexOf(pattern);
    if (index !== -1) {
      return { index, length: pattern.length };
    }
  }
  return null;
}

/**
 * 流式客户端
 * 
 * 负责：
 * 1. 发起流式 HTTP 请求
 * 2. 解析 SSE (Server-Sent Events) 响应
 * 3. 检测内容边界并发射事件
 * 4. 累积完整响应
 */
export class StreamingClient {
  private readonly eventHandlers: AnalysisEventHandlers;
  private readonly emittedEvents: AnalysisEvent[] = [];
  
  // 事件发射状态追踪
  private hasEmittedFirstToken = false;
  private hasEmittedThinkStart = false;
  private hasEmittedContentStart = false;
  
  // 内容累积状态
  private contentBuffer = '';
  private isInThinkBlock = false;
  private finishReason: string | undefined;
  
  // 边界检测模式（字符串形式）
  private readonly thinkStartPatterns: string[];
  private readonly thinkEndPatterns: string[];

  constructor(
    private readonly config: StreamingClientConfig,
    thinkPatterns?: ThinkPatternConfig
  ) {
    this.eventHandlers = config.eventHandlers ?? {};
    
    // 可配置的思考块检测模式
    this.thinkStartPatterns = thinkPatterns?.start ?? DEFAULT_THINK_START_PATTERNS;
    this.thinkEndPatterns = thinkPatterns?.end ?? DEFAULT_THINK_END_PATTERNS;
  }

  /**
   * 执行一次性请求，返回完整响应
   * 简化实现：一次性触发所有事件（first-token + think-start → content-start）
   */
  async execute(): Promise<StreamingClientResult> {
    const endpoint = this.normalizeBaseUrl(this.config.baseUrl) + '/chat/completions';
    
    const response = await this.initiateRequest(endpoint);
    const content = await this.processResponse(response);
    
    return {
      response: {
        content,
        source: 'message_content',
        finishReason: this.finishReason,
      },
      events: this.emittedEvents,
    };
  }

  /**
   * 发起一次性请求（非流式）
   */
  private async initiateRequest(endpoint: string): Promise<Response> {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...this.config.payload,
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorData = await this.tryParseErrorResponse(response);
        throw createAppError({
          code: 'provider_request_failed',
          message: errorData?.error?.message ?? `远程分析请求失败：HTTP ${response.status}`,
          status: response.status,
          retryable: response.status >= 500,
        });
      }

      return response;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw createAppError({
        code: 'network_error',
        message: '远程分析请求失败，请检查网络、跨域配置或模型服务地址',
        retryable: true,
      });
    }
  }

  /**
   * 处理一次性响应
   * 简化策略：立即触发所有事件（first-token + think-start → content-start）
   */
  private async processResponse(response: Response): Promise<string> {
    const data = await response.json();
    
    // 提取内容（优先 content，这是实际结果；reasoning_content 是思考过程）
    const message = data.choices?.[0]?.message;
    let content = '';
    
    if (message?.content) {
      content = message.content;
    } else if (message?.reasoning_content) {
      // 兜底：某些模型可能只返回 reasoning_content
      content = message.reasoning_content;
    }
    
    this.finishReason = data.choices?.[0]?.finish_reason;
    this.contentBuffer = content;

    // 简化的事件触发：一次性触发所有事件
    // 1. 触发 first-token（同时触发 think-start 作为简化策略）
    this.emitEvent('first-token');
    this.hasEmittedFirstToken = true;
    
    // 2. 同时触发 think-start（绑定到 first-token）
    this.emitEvent('think-start');
    this.hasEmittedThinkStart = true;
    
    // 3. 立即触发 content-start（因为是完整响应，直接开始正文）
    this.emitEvent('content-start');
    this.hasEmittedContentStart = true;

    return content;
  }

  /**
   * 发射事件
   */
  private emitEvent(type: 'first-token' | 'think-start' | 'content-start'): void {
    const event: AnalysisEvent = {
      type,
      timestamp: Date.now(),
    };

    this.emittedEvents.push(event);

    // 调用对应的回调
    switch (type) {
      case 'first-token':
        this.eventHandlers.onFirstToken?.(event);
        break;
      case 'think-start':
        this.eventHandlers.onThinkStart?.(event);
        break;
      case 'content-start':
        this.eventHandlers.onContentStart?.(event);
        break;
    }
  }

  /**
   * 尝试解析错误响应
   */
  private async tryParseErrorResponse(response: Response): Promise<{ error?: { message?: string } } | null> {
    try {
      const text = await response.text();
      if (!text.trim()) return null;
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  /**
   * 规范化基础 URL
   */
  private normalizeBaseUrl(baseUrl: string): string {
    return baseUrl.trim().replace(/\/$/, '');
  }
}
