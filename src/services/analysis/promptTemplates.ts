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

const createTemplate = (
  evaluationGoal: EvaluationGoal,
  title: string,
  focusInstruction: string,
): PromptTemplateResource => ({
  templateId: `tpl-text-diagnosis-${evaluationGoal}`,
  version: '2.0.0',
  scenario: 'text_diagnosis',
  providerProfile: 'openai-compatible',
  evaluationGoal,
  title,
  systemPromptTemplate: [
    '你是一名中文文本评审助手，负责输出结构化中文 JSON 报告。',
    '请严格围绕当前评价目标执行分析，不要泄露思考过程，不要输出 markdown。',
    '报告分为两部分：静态头部与动态正文。静态头部只包含 summary、dashboard、conclusion；动态正文只通过 sections 数组表达。',
    'sections 的展示顺序即前端渲染顺序。每个 section 只允许包含 title 与 body 两个核心字段，不要输出额外的模块类型、嵌套 data 或列表结构。',
    'sections 必须覆盖主要分析内容，并与 summary、dashboard、conclusion 保持一致，不得冲突。',
    '请仅返回合法 JSON，对象结构必须满足以下约束：',
    '{',
    '  "summary": { "title": string, "overview": string },',
    '  "dashboard": { "totalScore": number, "grade": string, "publishReadiness": string },',
    '  "conclusion": { "finalRecommendation": "publish" | "revise_then_publish" | "rework", "rationale": string },',
    '  "sections": [{ "title": string, "body": string, "id"?: string }]',
    '}',
    '分数范围必须为 0-100，sections 保持 3-6 段，每段 body 使用完整自然语言正文表达。',
    focusInstruction,
  ].join('\n'),
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
  outputSchemaRef: 'report_schema_v1',
  policyMeta: {
    scoringPolicyVersion: '2.0.0',
    conclusionPolicyVersion: '2.0.0',
    reportFormatVersion: '2.0.0',
  },
  recommendedParameters: {
    temperature: 0.3,
    maxTokens: 1400,
  },
});

const promptTemplateMap: Record<EvaluationGoal, PromptTemplateResource> = {
  overall_check: createTemplate(
    'overall_check',
    '发布前总体检查模板',
    '重点综合评估完成度、可发布性与优先修改项。',
  ),
  opening_attraction: createTemplate(
    'opening_attraction',
    '开篇吸引力模板',
    '重点检查开篇钩子、信息投放、首段张力与继续阅读意愿。',
  ),
  rhythm_progression: createTemplate(
    'rhythm_progression',
    '节奏与推进模板',
    '重点检查段落节奏、情节推进效率、信息冗余与停滞问题。',
  ),
  character_development: createTemplate(
    'character_development',
    '人物塑造模板',
    '重点检查人物动机、人物区分度、情感变化与关系推进。',
  ),
  style_consistency: createTemplate(
    'style_consistency',
    '文风一致性模板',
    '重点检查叙述视角、语言质感、措辞稳定性与风格统一程度。',
  ),
  structure_completeness: createTemplate(
    'structure_completeness',
    '结构完整性模板',
    '重点检查结构闭环、章节功能分配、铺垫回收与叙事完整性。',
  ),
  reader_acceptance: createTemplate(
    'reader_acceptance',
    '读者接受度模板',
    '重点检查目标读者匹配度、爽点/卖点表达、留存风险与市场接受度。',
  ),
};

export function getPromptTemplate(evaluationGoal: EvaluationGoal): PromptTemplateResource {
  return promptTemplateMap[evaluationGoal];
}
