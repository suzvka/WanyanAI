import type { ModelAnalysisMessage } from '@/types/analysis';
import type { AnalysisEventHandlers } from '@/types/streamEvents';

/**
 * ModelClient 配置选项
 */
export type ModelClientOptions = {
  /** API 基础 URL */
  baseUrl: string;
  /** API 密钥 */
  apiKey: string;
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
};

/**
 * ModelClient 响应结果
 */
export type ModelClientResult = {
  /** 模型返回的内容 */
  content: string;
  /** 结束原因 */
  finishReason?: string;
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
