import { 
    renderTextBlockMetadataForModel, 
    renderTextBlocksForModel 
} from '@/lib/textBlocks';
import type {
    ModelAnalysisMessage,
    PromptTemplateResource,
    PromptTemplateSlotKey,
} from '@/types/analysis';
import type { ContainerConfig } from '@/types/module';
import type { EvaluationInput } from '@/types/report';

type PromptSlotValues = Record<PromptTemplateSlotKey, string>;

const promptSlotPattern = /{{(.*?)}}/g;

const minimumInitialMaxTokens = 2200;
const maximumGenerationMaxTokens = 3200;

/**
 * 构建分析请求的配置参数
 */
export type BuildAnalysisMessagesConfig = {
  /** 评价输入数据 */
  input: EvaluationInput;
  /** 提示词模板资源 */
  template: PromptTemplateResource;
  /** 动态指令文本 */
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
  /** 槽位值（用于调试） */
  slotValues: PromptSlotValues;
};

/**
 * 构建分析请求消息
 * 
 * 将业务数据转换为模型可理解的消息格式
 */
export function buildAnalysisMessages(
  config: BuildAnalysisMessagesConfig
): BuildAnalysisMessagesResult {
  const { input, template, instructionText, mcpToolText } = config;

  const slotValues = createSlotValues(input, instructionText, mcpToolText);

  console.log('[buildAnalysisMessages] Slot values:', {
    textBlocksMetadataLength: slotValues.textBlocksMetadata.length,
    textBlocksPlainTextLength: slotValues.textBlocksPlainText.length,
    dynamicInstructionTextLength: slotValues.dynamicInstructionText.length,
    mcpToolTextLength: slotValues.mcpToolText.length,
  });

  const messages = buildMessages(template, slotValues);
  const maxTokens = calculateGenerationMaxTokens(
    template.recommendedParameters.maxTokens ?? 8192,
    slotValues.textBlocksPlainText.length,
  );

  return {
    messages,
    maxTokens,
    slotValues,
  };
}

/**
 * 创建槽位值映射
 */
function createSlotValues(
  input: EvaluationInput,
  instructionText?: string,
  mcpToolText?: string,
): PromptSlotValues {
  const metadata = renderTextBlockMetadataForModel(input);
  
  return {
    textBlocksMetadata: metadata,
    textBlocksPlainText: renderTextBlocksForModel(input),
    dynamicInstructionText: instructionText?.trim() || '',
    mcpToolText: mcpToolText?.trim() || '',
  };
}

/**
 * 构建消息列表
 */
function buildMessages(
  template: PromptTemplateResource, 
  slotValues: PromptSlotValues
): ModelAnalysisMessage[] {
  return [
    {
      role: 'system' as const,
      content: fillPromptTemplate(template.systemPromptTemplate, slotValues),
    },
    {
      role: 'user' as const,
      content: fillPromptTemplate(template.userPromptTemplate, slotValues),
    },
  ];
}

/**
 * 填充提示词模板
 */
function fillPromptTemplate(
  template: string,
  slotValues: PromptSlotValues
): string {
  const result = template.replace(promptSlotPattern, (_, rawKey: string) => {
    const key = rawKey.trim() as PromptTemplateSlotKey;
    const value = slotValues[key];

    if (value == null) {
      return '';
    }

    return value;
  });

  // 添加调试日志
  if (result.includes('language_expression') || result.includes('structural_logic')) {
    console.log('[buildAnalysisMessages] Template contains subscore definitions');
  }

  return result;
}

/**
 * 计算生成参数中的 maxTokens
 * 根据输入文本长度动态调整
 */
function calculateGenerationMaxTokens(
  recommendedMaxTokens: number, 
  plainTextLength: number
): number {
  const baseTokens = Math.max(recommendedMaxTokens, minimumInitialMaxTokens);

  if (plainTextLength >= 30000) {
    return Math.min(maximumGenerationMaxTokens, baseTokens + 800);
  }

  if (plainTextLength >= 18000) {
    return Math.min(maximumGenerationMaxTokens, baseTokens + 500);
  }

  if (plainTextLength >= 8000) {
    return Math.min(maximumGenerationMaxTokens, baseTokens + 250);
  }

  return baseTokens;
}
