/**
 * 中转站模块类型定义
 * 
 * 中转站（Station）是自包含的 LLM 转发器，仅负责将请求转发到具体的模型服务。
 * 权限解析与限流由主入口（src/app/api/v1/chat/completions/route.ts）统一处理，
 * 中转站不再参与权限解析和限流决策。
 * 
 * authKey 透传给子站：openai-forward 站将其用作用户自持 API Key 直接调用上游服务，
 * coze 站忽略 authKey（使用 Coze SDK 内置凭证）。
 */

import type { NextRequest } from 'next/server';

/**
 * 中转站提供的模型信息
 */
export interface StationModel {
  /** 模型唯一标识 */
  id: string;
  
  /** 模型显示名称（可选，用于前端展示） */
  name?: string;
  
  /** 模型描述（可选） */
  description?: string;
  
  /** 每小时最大调用次数（可选，用于限流） */
  maxCallsPerHour?: number;
}

/**
 * 转发请求参数
 */
export interface ForwardRequest {
  /** 请求的模型 ID */
  model: string;
  
  /** 消息列表 */
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  
  /** 是否流式输出 */
  stream?: boolean;
  
  /** 温度参数 */
  temperature?: number;
  
  /** 最大输出 token 数 */
  max_tokens?: number;
  
  /** 其他参数 */
  [key: string]: unknown;
  
  /** 原始请求头（用于透传） */
  headers: Headers;
  
  /** 请求 ID（用于日志追踪） */
  requestId: string;

  /** 从 Authorization 头提取的用户 key（由主入口权限解析后透传，子站按需使用） */
  authKey?: string;
}

/**
 * 转发响应
 */
export interface ForwardResponse {
  /** 响应状态 */
  status: number;
  
  /** 响应头 */
  headers: Headers;
  
  /** 响应体（流式时为 ReadableStream，非流式时为 JSON） */
  body: ReadableStream<Uint8Array> | string;
}

/**
 * 中转站接口
 * 
 * 所有中转站必须实现此接口。
 * 中转站职责：
 * 1. 声明自己能处理的模型
 * 2. 将请求转发到具体的模型服务
 * 
 * 注意：权限解析与限流由主入口统一处理，中转站不应自行实现。
 */
export interface Station {
  /** 中转站唯一标识 */
  readonly id: string;
  
  /** 中转站显示名称 */
  readonly name: string;
  
  /**
   * 获取此中转站提供的模型列表
   * 返回空数组表示此中转站当前不可用（例如环境不满足）
   */
  getModels(): StationModel[] | Promise<StationModel[]>;
  
  /**
   * 判断是否处理该模型
   * @param modelId 模型 ID
   * @returns 是否由本中转站处理
   */
  canHandle(modelId: string): boolean;
  
  /**
   * 转发请求
   * @param request 转发请求参数
   * @returns 响应（支持流式和非流式）
   */
  forward(request: ForwardRequest): Promise<Response>;
}

/**
 * 中转站注册表接口
 */
export interface StationRegistry {
  /**
   * 注册中转站
   */
  register(station: Station): void;
  
  /**
   * 获取所有可用的模型
   */
  getAllModels(): Promise<StationModel[]>;
  
  /**
   * 查找能处理指定模型的中转站
   * @returns 中转站实例，如果没有找到返回 null
   */
  findStation(modelId: string): Station | null;
  
  /**
   * 获取所有已注册的中转站
   */
  getStations(): Station[];
  
  /**
   * 重置注册表（用于测试）
   */
  reset(): void;
}
