type DimensionOption<T extends string> = {
  value: T;
  label: string;
};

function buildDimensionOptions<const T extends readonly string[]>(
  values: T,
  labels: Record<T[number], string>,
): Array<DimensionOption<T[number]>> {
  return values.map((value) => ({
    value,
    label: labels[value as T[number]],
  }));
}

export const textTypeValues = [
  'web_serial',
  'short_story',
  'light_novel',
  'literary_submission',
  'general_text',
] as const;

export const textCompletenessValues = [
  'complete',
  'single_chapter',
  'first_chapters',
  'excerpt',
  'draft',
] as const;

export const evaluationGoalValues = [
  'overall_check',
  'opening_attraction',
  'rhythm_progression',
  'character_development',
  'style_consistency',
  'structure_completeness',
  'reader_acceptance',
] as const;

export type TextTypeValue = (typeof textTypeValues)[number];
export type TextCompletenessValue = (typeof textCompletenessValues)[number];
export type EvaluationGoalValue = (typeof evaluationGoalValues)[number];

export const textTypeLabels: Record<TextTypeValue, string> = {
  web_serial: '网络连载',
  short_story: '短篇小说',
  light_novel: '轻小说/青年向',
  literary_submission: '文学投稿',
  general_text: '通用文本',
};

export const textCompletenessLabels: Record<TextCompletenessValue, string> = {
  complete: '完整作品',
  single_chapter: '长篇中的单章/样章',
  first_chapters: '长篇前若干章',
  excerpt: '节选片段',
  draft: '未完成草稿',
};

export const evaluationGoalLabels: Record<EvaluationGoalValue, string> = {
  overall_check: '发布前总体检查',
  opening_attraction: '开篇吸引力检查',
  rhythm_progression: '节奏与推进问题',
  character_development: '人物塑造检查',
  style_consistency: '文风一致性检查',
  structure_completeness: '结构完整性检查',
  reader_acceptance: '读者接受度预估',
};

export const textTypeOptions = buildDimensionOptions(textTypeValues, textTypeLabels);
export const textCompletenessOptions = buildDimensionOptions(textCompletenessValues, textCompletenessLabels);
export const evaluationGoalOptions = buildDimensionOptions(evaluationGoalValues, evaluationGoalLabels);
