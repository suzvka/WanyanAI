import 'server-only';

import { evaluationGoalLabels } from '@/config/evaluationDimensions';
import { composeSystemPromptFromBlocks } from '@/server/promptBlocks';
import type { PromptTemplateResource } from '@/types/analysis';
import type { EvaluationGoal } from '@/types/report';

const baseSlots: PromptTemplateResource['slots'] = [
  { key: 'textTypeLabel', label: '文本类型', required: true },
  { key: 'textCompletenessLabel', label: '文本完整度', required: true },
  { key: 'evaluationGoalLabel', label: '评价目标', required: true },
  { key: 'dynamicInstructionText', label: '动态检查指令', required: false },
  { key: 'textBlocksSummary', label: '文本块摘要', required: true },
  { key: 'textBlocksPlainText', label: '待分析纯文本内容', required: true },
];

type PromptTemplateConfig = {
  focusInstruction: string;
};

async function buildSystemPromptTemplate(focusInstruction: string) {
  const basePrompt = await composeSystemPromptFromBlocks();
  const focusBlock = ['# 当前评价重点', '', focusInstruction].join('\n');

  return basePrompt ? [basePrompt, focusBlock].join('\n\n') : focusBlock;
}

async function createTemplate(
  evaluationGoal: EvaluationGoal,
  config: PromptTemplateConfig,
): Promise<PromptTemplateResource> {
  return {
    templateId: `tpl-text-diagnosis-${evaluationGoal}`,
    version: '3.0.0',
    scenario: 'text_diagnosis',
    providerProfile: 'openai-compatible',
    evaluationGoal,
    title: `${evaluationGoalLabels[evaluationGoal]}模板`,
    systemPromptTemplate: await buildSystemPromptTemplate(config.focusInstruction),
    userPromptTemplate: [
      '请基于以下上下文生成结构化评审报告：',
      '- 文本类型：{{textTypeLabel}}',
      '- 文本完整度：{{textCompletenessLabel}}',
      '- 评价目标：{{evaluationGoalLabel}}',
      '- 附加检查指令（如无内容则表示本次未额外指定）：',
      '{{dynamicInstructionText}}',
      '- 文本块摘要：{{textBlocksSummary}}',
      '',
      '待分析纯文本内容如下：',
      '{{textBlocksPlainText}}',
    ].join('\n'),
    slots: baseSlots,
    outputSchemaRef: 'report_schema_v3_subscores',
    policyMeta: {
      scoringPolicyVersion: '3.0.0',
      conclusionPolicyVersion: '2.0.0',
      reportFormatVersion: '3.0.0',
    },
    recommendedParameters: {
      temperature: 0.3,
      maxTokens: 1400,
    },
  };
}

const promptTemplateConfigMap: Record<EvaluationGoal, PromptTemplateConfig> = {
  overall_check: {
    focusInstruction: '重点综合评估完成度、可发布性与优先修改项。',
  },
  opening_attraction: {
    focusInstruction: '重点检查开篇钩子、信息投放、首段张力与继续阅读意愿。',
  },
  rhythm_progression: {
    focusInstruction: '重点检查段落节奏、情节推进效率、信息冗余与停滞问题。',
  },
  character_development: {
    focusInstruction: '重点检查人物动机、人物区分度、情感变化与关系推进。',
  },
  style_consistency: {
    focusInstruction: '重点检查叙述视角、语言质感、措辞稳定性与风格统一程度。',
  },
  structure_completeness: {
    focusInstruction: '重点检查结构闭环、章节功能分配、铺垫回收与叙事完整性。',
  },
  reader_acceptance: {
    focusInstruction: '重点检查目标读者匹配度、爽点/卖点表达、留存风险与市场接受度。',
  },
};

export function getPromptTemplate(evaluationGoal: EvaluationGoal): Promise<PromptTemplateResource> {
  return createTemplate(evaluationGoal, promptTemplateConfigMap[evaluationGoal]);
}
