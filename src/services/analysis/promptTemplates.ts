import 'server-only';

import { evaluationGoalLabels } from '@/config/evaluationDimensions';
import { composeSystemPromptFromBlocks } from '@/server/promptBlocks';
import { getServerOutputModePrompt, getServerOutputModeIds } from '@/server/output-modes';
import type { PromptTemplateResource } from '@/types/analysis';
import type { EvaluationGoal } from '@/types/report';

const baseSlots: PromptTemplateResource['slots'] = [
  { key: 'textBlocksMetadata', label: '文本块元数据', required: true },
  { key: 'textBlocksPlainText', label: '待分析纯文本内容', required: true },
  { key: 'dynamicInstructionText', label: '动态评价目标', required: false },
  { key: 'mcpToolText', label: '可调用 MCP 工具', required: false },
];

async function createTemplate(
  evaluationGoal: EvaluationGoal,
  outputMode?: string
): Promise<PromptTemplateResource> {
  const goalLabel = evaluationGoalLabels[evaluationGoal as keyof typeof evaluationGoalLabels] || evaluationGoal;

  // 构建基础系统提示词
  let systemPrompt = await composeSystemPromptFromBlocks();
  console.log('[createTemplate] Base system prompt length:', systemPrompt.length);

  // 如果有输出模式，追加输出模式的格式声明（使用服务端注册的提示词）
  if (outputMode) {
    const outputModePrompt = getServerOutputModePrompt(outputMode);
    console.log('[createTemplate] ========== Output Mode Debug ==========');
    console.log('[createTemplate] Output mode ID:', outputMode);
    console.log('[createTemplate] Output mode prompt found:', !!outputModePrompt);
    console.log('[createTemplate] Output mode prompt length:', outputModePrompt?.length || 0);
    console.log('[createTemplate] Available output modes:', getServerOutputModeIds());
    if (outputModePrompt) {
      console.log('[createTemplate] Output mode prompt sample:', outputModePrompt.substring(0, 500));
      systemPrompt = `${systemPrompt}\n\n${outputModePrompt}`;
      console.log('[createTemplate] Final system prompt length:', systemPrompt.length);
      console.log('[createTemplate] Final system prompt contains language_expression:', systemPrompt.includes('language_expression'));
      console.log('[createTemplate] Final system prompt contains structural_logic:', systemPrompt.includes('structural_logic'));
    } else {
      console.error('[createTemplate] No output mode prompt found for:', outputMode);
    }
    console.log('[createTemplate] ========== End Output Mode Debug ==========');
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
      '{{mcpToolText}}',
      '',
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
