/**
 * JSON 修复模块类型定义
 */

import type { ProgressController } from '@/features/analysis-progress';

/**
 * JSON 修复服务配置
 */
export type JsonRepairConfig = {
  /** API 基础 URL */
  baseUrl: string;
  /** API 密钥 */
  apiKey: string;
  /** 模型标识 */
  model: string;
  /** 进度控制器（可选） */
  progressController?: ProgressController;
  /** 温度参数（可选） */
  temperature?: number;
  /** 最大 token 数（可选） */
  maxTokens?: number;
};

/**
 * JSON 修复请求参数
 */
export type JsonRepairParams = {
  /** 格式定义提示词 */
  schemaPrompt: string;
  /** 待修复的 JSON 文本 */
  malformedJson: string;
};

/**
 * JSON 修复结果
 */
export type JsonRepairResult = {
  /** 是否成功 */
  success: boolean;
  /** 修复后的 JSON 数据（成功时） */
  data?: unknown;
  /** 修复后的 JSON 文本（成功时） */
  repairedJsonText?: string;
  /** 错误信息（失败时） */
  error?: string;
  /** 模型原始响应 */
  rawResponse?: string;
  /** 尝试次数 */
  attempts: number;
};

/**
 * JSON 修复服务接口
 */
export interface JsonRepairService {
  /**
   * 修复 JSON 数据
   * @param config 配置
   * @param params 修复参数
   * @returns 修复结果
   */
  repair(config: JsonRepairConfig, params: JsonRepairParams): Promise<JsonRepairResult>;
}
