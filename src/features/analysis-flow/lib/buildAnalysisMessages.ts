import {
  renderTextBlockMetadataForModel,
  renderTextBlocksForModel,
} from '@/lib/textBlocks';
import type { ModelAnalysisMessage } from '@/types/analysis';
import type { ContainerConfig } from '@/types/module';
import type { EvaluationInput } from '@/types/report';

const minimumInitialMaxTokens = 2200;
const maximumGenerationMaxTokens = 3200;

/**
 * 构建分析请求的配置参数
 */
export type BuildAnalysisMessagesConfig = {
  /** 评价输入数据 */
  input: EvaluationInput;
  /** 系统提示词 */
  systemPrompt: string;
  /** 动态指令文本（控件编译结果） */
  instructionText?: string;
  /** MCP 工具提示词 */
  mcpToolText?: string;
  /** 容器配置列表 */
  containers?: ContainerConfig[];
};

/**
 * 构建分析请求的返回结果
 */
export type BuildAnalysisMessagesResult = {
  /** 构建好的消息列表 */
  messages: ModelAnalysisMessage[];
  /** 计算出的 maxTokens 参数 */
  maxTokens: number;
};

/**
 * 构建分析请求消息
 *
 * 将业务数据直接转换为模型可理解的消息格式，
 * 不再使用槽位填充机制。
 */
export function buildAnalysisMessages(
  config: BuildAnalysisMessagesConfig,
): BuildAnalysisMessagesResult {
  const { input, systemPrompt, instructionText, mcpToolText } = config;

  // 用户提示词：按顺序拼接各部分
  const userParts: string[] = [];

  if (mcpToolText?.trim()) {
    userParts.push(mcpToolText.trim());
  }

  if (instructionText?.trim()) {
    userParts.push(instructionText.trim());
  }

  userParts.push(renderTextBlockMetadataForModel(input));
  userParts.push(renderTextBlocksForModel(input));

  const messages: ModelAnalysisMessage[] = [
    {
      role: 'system',
      content: systemPrompt,
    },
    {
      role: 'user',
      content: userParts.join('\n\n'),
    },
  ];

  const maxTokens = calculateMaxTokens(8192, userParts.join('\n\n').length);

  return { messages, maxTokens };
}

/**
 * 根据输入文本长度动态计算 maxTokens
 */
function calculateMaxTokens(
  recommendedMaxTokens: number,
  plainTextLength: number,
): number {
  const baseTokens = Math.max(recommendedMaxTokens, minimumInitialMaxTokens);

  if (plainTextLength >= 30000) {
    return Math.min(maximumGenerationMaxTokens, baseTokens + 800);
  }

  if (plainTextLength >= 18000) {
    return Math.min(maximumGenerationMaxTokens, baseTokens + 500);
  }

  return baseTokens;
}
