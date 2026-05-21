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
 * ModelClient callWithTools 配置选项
 * 
 * 使用标准 OpenAI tool_calling 协议（非流式），
 * 用于 AgentRunner 编排 LLM 自主决策调用顺序。
 * 
 * messages 使用宽松类型以支持完整 OpenAI 消息格式
 * （包括 tool 消息的 tool_call_id 和 assistant 消息的 tool_calls 字段）
 */
export type ModelClientToolCallOptions = {
  baseUrl: string;
  apiKey: string;
  model: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages: any[];
  tools: Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: {
        type: 'object';
        properties: Record<string, unknown>;
        required: string[];
      };
    };
  }>;
  temperature?: number;
  /** 最多迭代次数（超过后强制 tool_choice: 'none'） */
  maxIterations?: number;
  /** 当前迭代次数（用于判断是否强制结束） */
  currentIteration?: number;
};

/**
 * ModelClient callWithTools 响应结果
 */
export type ModelClientToolCallResult = {
  /** 模型文本回复 */
  content: string | null;
  /** OpenAI 原生 tool_calls */
  toolCalls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
  /** 结束原因 */
  finishReason?: string;
};

/**
 * ModelClient 服务接口
 */
export interface ModelClient {
  /**
   * 调用模型 API（MCP 流式）
   * @param options 调用配置
   * @returns 模型响应
   */
  call(options: ModelClientOptions): Promise<ModelClientResult>;

  /**
   * 调用模型 API（OpenAI 原生 tool_calling，非流式）
   * 
   * 用于 Agent 编排场景，Agent LLM 通过 tool_calling 协议自主决策
   * 调用哪些步骤以及调用顺序。
   * 
   * @param options 调用配置
   * @returns 模型响应（含 tool_calls）
   */
  callWithTools(options: ModelClientToolCallOptions): Promise<ModelClientToolCallResult>;
}
