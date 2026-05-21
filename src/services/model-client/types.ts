/**
 * ModelClient — 纯 HTTP 透传访问器
 *
 * 全局单例。不感知 MCP、tools、<call> 标签等业务概念。
 * 仅负责：接收参数 → JSON.stringify → POST 到 LLM API → 返回原始响应。
 */

/** 单例配置（可随时替换） */
export interface ModelClientConfig {
  /** API 端点，例如 'https://api.deepseek.com' 或 '/api/v1'（走中转站） */
  baseUrl: string;
  /** API Key（可选，不传则不发送 Authorization 头） */
  apiKey?: string;
}

/** 请求参数（model 和 messages 必需，其余全部透传到请求体） */
export interface ChatParams {
  model: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages: any;
  [key: string]: unknown;
}

/** ModelClient 服务接口 */
export interface ModelClient {
  /** 更新配置（baseUrl / apiKey） */
  configure(config: ModelClientConfig): void;

  /**
   * 一次性调用：发送请求，返回完整的原始 JSON 响应体。
   * 调用方自行提取 choices[0].message.content / tool_calls 等字段。
   */
  chat(params: ChatParams): Promise<Record<string, unknown>>;

  /**
   * 流式调用：发送 stream:true 请求，返回异步可迭代的文本 chunk。
   * 每个 chunk 是 SSE delta 中的 content 字段。
   * 调用方自行拼接完整内容或解析其中的 <call> 标签。
   */
  chatStream(params: ChatParams): AsyncIterable<string>;
}
