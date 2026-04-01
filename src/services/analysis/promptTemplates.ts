import 'server-only';

import { evaluationGoalLabels } from '@/config/evaluationDimensions';
import { composeSystemPromptFromBlocks } from '@/server/promptBlocks';
import { getOutputModePrompt } from '@/features/output-modes';
import type { PromptTemplateResource } from '@/types/analysis';
import type { EvaluationGoal } from '@/types/report';

const baseSlots: PromptTemplateResource['slots'] = [
  { key: 'textBlocksMetadata', label: '文本块元数据', required: true },
  { key: 'textBlocksPlainText', label: '待分析纯文本内容', required: true },
  { key: 'dynamicInstructionText', label: '动态评价目标', required: false },
];

async function createTemplate(
  evaluationGoal: EvaluationGoal,
  outputMode?: string
): Promise<PromptTemplateResource> {
  const goalLabel = evaluationGoalLabels[evaluationGoal as keyof typeof evaluationGoalLabels] || evaluationGoal;
  
  // 构建基础系统提示词
  let systemPrompt = await composeSystemPromptFromBlocks();
  
  // 如果有输出模式，追加输出模式的格式声明
  if (outputMode) {
    const outputModePrompt = getOutputModePrompt(outputMode);
    if (outputModePrompt) {
      systemPrompt = `${systemPrompt}\n\n${outputModePrompt}`;
    }
  }
  
  return {
    templateId: `tpl-text-diagnosis-${evaluationGoal}`,
        version: '5.0.0',
    scenario: 'text_diagnosis',
    providerProfile: 'openai-compatible',
    evaluationGoal,
    title: `${goalLabel}模板`,
    systemPromptTemplate: systemPrompt,
    userPromptTemplate: [
      '{{dynamicInstructionText}}',
      '',
      '{{textBlocksMetadata}}',
      '',
      '{{textBlocksPlainText}}',
    ].join('\n'),
    slots: baseSlots,
    outputSchemaRef: 'report_schema_v5_0_ratings',
    policyMeta: {
      scoringPolicyVersion: '5.0.0',
      conclusionPolicyVersion: '5.0.0',
      reportFormatVersion: '5.0.0',
    },
    recommendedParameters: {
      temperature: 0.3,
    },
  };
}

export function getPromptTemplate(
  evaluationGoal: EvaluationGoal,
  outputMode?: string
): Promise<PromptTemplateResource> {
  return createTemplate(evaluationGoal, outputMode);
}
