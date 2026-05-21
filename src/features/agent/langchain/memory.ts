/**
 * 上下文窗口管理
 *
 * 使用 LangChain trimMessages 管理 Agent 编排过程中的消息历史，
 * 防止上下文窗口溢出。在每次 LLM 调用前自动裁剪超出限制的消息。
 *
 * 策略：保留 system 消息 + 最近 N 条消息（按 token 数裁剪），
 * 确保 Agent 不会因历史消息过多而超出模型上下文窗口。
 */

import {
  trimMessages,
  type BaseMessage,
} from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';

/**
 * 上下文裁剪器配置
 */
export interface ContextTrimmerConfig {
  /** Agent LLM 实例（用于 token 计数） */
  chatModel: ChatOpenAI;
  /** 上下文窗口最大 token 数（默认 8000） */
  maxTokens?: number;
}

/**
 * 创建消息裁剪器
 *
 * @param config 配置参数
 * @returns 裁剪函数
 */
export function createContextTrimmer(config: ContextTrimmerConfig) {
  const maxTokens = config.maxTokens ?? 8000;

  /**
   * 裁剪消息历史，确保在上下文窗口内
   *
   * @param messages  完整的消息历史
   * @returns 裁剪后的消息数组
   */
  return async function trimContext(messages: BaseMessage[]): Promise<BaseMessage[]> {
    return trimMessages(messages, {
      maxTokens,
      strategy: 'last',        // 保留最近的消息
      tokenCounter: config.chatModel,
      includeSystem: true,     // 确保系统提示词不被裁剪
      startOn: 'human',        // 从 human 消息开始保留
      allowPartial: false,     // 不保留部分消息
    });
  };
}
