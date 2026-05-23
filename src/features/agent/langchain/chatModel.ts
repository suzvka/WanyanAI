/**
 * LangChain ChatOpenAI 工厂
 *
 * 将现有的 modelConfig 桥接到 LangChain 的 ChatOpenAI，
 * 仅用于 Agent LLM 编排层（决定步骤调用顺序），
 * 不参与输出模式内部的 LLM 调用（输出模式仍走 modelClient）。
 */

import { ChatOpenAI } from '@langchain/openai';
import type { ModelConfig } from '@/types/modelConfig';
import { ensureBuiltInApiKey } from '@/lib/api-station/builtInConfig';

/**
 * 根据模型配置创建 ChatOpenAI 实例
 *
 * @param modelConfig  用户选择的模型配置（baseUrl/apiKey/selectedModel）
 * @returns 配置好的 ChatOpenAI 实例，用于 Agent 编排决策
 */
export function createAgentChatModel(modelConfig: ModelConfig): ChatOpenAI {
  const baseUrl = modelConfig.baseUrl || '/api/v1';
  const apiKey = modelConfig.apiKey || ensureBuiltInApiKey();

  return new ChatOpenAI({
    model: modelConfig.selectedModel,
    temperature: 0.3,
    configuration: {
      baseURL: `${baseUrl}/chat/completions`,
      apiKey,
    },
  });
}
