import type { ModelAnalysisMessage } from '@/types/analysis';
import type { AnalysisEventHandlers } from '@/types/streamEvents';
import type { McpToolDefinition } from '@/mcp/types';

/**
 * ModelClient 配置选项
 */
export type ModelClientOptions = {
  /** API 基础 URL（客户端直连模式必须） */
  baseUrl?: string;
  /** API 密钥（客户端直连模式必须） */
  apiKey?: string;
  /** 模型标识 */
  model: string;
  /** 消息列表 */
  messages: ModelAnalysisMessage[];
  /** 温度参数 */
  temperature?: number;
  /** 最大 token 数 */
  maxTokens?: number;
  /** 事件回调处理器 */
  events?: AnalysisEventHandlers;
  /** MCP 工具定义（来自输出模式模块） */
  mcpToolDefinitions?: McpToolDefinition[];
};

/**
 * ModelClient 响应结果
 */
export type ModelClientResult = {
  /** 模型返回的内容 */
  content: string;
  /** 结束原因 */
  finishReason?: string;
  /** 捕获的工具调用（如果有） */
  toolCall?: { name: string; params: Record<string, unknown> } | null;
};

/**
 * ModelClient 服务接口
 */
export interface ModelClient {
  /**
   * 调用模型 API
   * @param options 调用配置
   * @returns 模型响应
   */
  call(options: ModelClientOptions): Promise<ModelClientResult>;
}
