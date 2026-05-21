/**
 * Agent 系统提示词模板
 *
 * 使用 LangChain ChatPromptTemplate 构建 Agent 编排层的系统提示词，
 * 支持变量注入和 Few-shot 模板（未来扩展）。
 */

import { ChatPromptTemplate } from '@langchain/core/prompts';
import type { AgentPipeline } from '@/types/module';

/**
 * 构建步骤列表描述文本
 */
function buildStepList(
  pipeline: AgentPipeline,
  descriptions: Map<string, { name: string; description: string }>,
): string {
  return pipeline.steps
    .map((s, i) => {
      const meta = descriptions.get(s.outputMode);
      return `${i + 1}. **${meta?.name ?? s.label}** (\`${s.outputMode}\`): ${meta?.description ?? s.label}`;
    })
    .join('\n');
}

/**
 * 构建系统提示词文本
 */
export function buildAgentSystemPromptText(
  pipeline: AgentPipeline,
  descriptions: Map<string, { name: string; description: string }>,
): string {
  const stepList = buildStepList(pipeline, descriptions);
  const terminalMeta = descriptions.get(pipeline.terminalStep.outputMode);

  return `You are an AI analysis coordinator. Your job is to orchestrate a multi-step text analysis pipeline.

## Available Analysis Steps
You may call any of these intermediate steps, in any order, as needed:

${stepList}

## Final Step (MUST BE LAST)
- **${terminalMeta?.name ?? pipeline.terminalStep.label}** (\`${pipeline.terminalStep.outputMode}\`): ${terminalMeta?.description ?? pipeline.terminalStep.label}

## Instructions
1. Analyze the input text by calling one or more intermediate analysis steps
2. You may skip steps that are not relevant and call steps multiple times if needed
3. After you have sufficient analysis, call the final step to produce the report
4. The final step MUST be the last tool you call — do not call any tools after it
5. Do not exceed ${pipeline.maxIterations} intermediate steps`;
}

/**
 * 构建 LangChain ChatPromptTemplate
 *
 * 模板变量：
 * - {system_prompt}: 系统提示词文本
 * - {input}: 用户输入文本
 *
 * 注意：ChatOpenAI.bindTools() 模式下，agent_scratchpad 由 LangChain
 * 内部自动管理，无需在模板中声明。
 */
export function createAgentPromptTemplate(): ChatPromptTemplate {
  return ChatPromptTemplate.fromMessages([
    ['system', '{system_prompt}'],
    ['human', '{input}'],
  ]);
}
