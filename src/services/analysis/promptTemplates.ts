import 'server-only';

import { evaluationGoalLabels } from '@/config/evaluationDimensions';
import { composeSystemPromptFromBlocks } from '@/server/promptBlocks';
import type { PromptTemplateResource } from '@/types/analysis';
import type { EvaluationGoal } from '@/types/report';

const baseSlots: PromptTemplateResource['slots'] = [
  { key: 'textBlocksMetadata', label: '文本块元数据', required: true },
  { key: 'textBlocksPlainText', label: '待分析纯文本内容', required: true },
];

async function createTemplate(evaluationGoal: EvaluationGoal): Promise<PromptTemplateResource> {
  return {
    templateId: `tpl-text-diagnosis-${evaluationGoal}`,
        version: '5.0.0',
    scenario: 'text_diagnosis',
    providerProfile: 'openai-compatible',
    evaluationGoal,
    title: `${evaluationGoalLabels[evaluationGoal]}模板`,
    systemPromptTemplate: await composeSystemPromptFromBlocks(),
    userPromptTemplate: ['{{textBlocksMetadata}}', '', '{{textBlocksPlainText}}'].join('\n'),
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

export function getPromptTemplate(evaluationGoal: EvaluationGoal): Promise<PromptTemplateResource> {
  return createTemplate(evaluationGoal);
}
