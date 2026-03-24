import {
  FeedbackStyle,
  ReaderPreference,
  SpecialConstraint,
  TextCompleteness,
  TextType,
  EvaluationGoal,
} from '@/types/report';

export type Option<T extends string> = {
  value: T;
  label: string;
};

export function getOptionLabel<T extends string>(options: Option<T>[], value: T): string {
  return options.find((option) => option.value === value)?.label || value;
}

export const textTypeOptions: Option<TextType>[] = [
  { value: 'web_serial', label: '网络连载' },
  { value: 'short_story', label: '短篇小说' },
  { value: 'light_novel', label: '轻小说/青年向' },
  { value: 'literary_submission', label: '文学投稿' },
  { value: 'general_text', label: '通用文本' },
];

export const textCompletenessOptions: Option<TextCompleteness>[] = [
  { value: 'complete', label: '完整作品' },
  { value: 'single_chapter', label: '长篇中的单章/样章' },
  { value: 'first_chapters', label: '长篇前若干章' },
  { value: 'excerpt', label: '节选片段' },
  { value: 'draft', label: '未完成草稿' },
];

export const evaluationGoalOptions: Option<EvaluationGoal>[] = [
  { value: 'overall_check', label: '发布前总体检查' },
  { value: 'opening_attraction', label: '开篇吸引力检查' },
  { value: 'rhythm_progression', label: '节奏与推进问题' },
  { value: 'character_development', label: '人物塑造检查' },
  { value: 'style_consistency', label: '文风一致性检查' },
  { value: 'structure_completeness', label: '结构完整性检查' },
  { value: 'reader_acceptance', label: '读者接受度预估' },
];

export const readerPreferenceOptions: Option<ReaderPreference>[] = [
  { value: 'fast_paced', label: '偏快节奏' },
  { value: 'plot_driven', label: '偏剧情推进' },
  { value: 'character_emotion', label: '偏人物情感' },
  { value: 'world_building', label: '偏世界观/设定' },
  { value: 'literary_expression', label: '偏文学表达' },
  { value: 'general_reader', label: '通用读者' },
];

export const feedbackStyleOptions: Option<FeedbackStyle>[] = [
  { value: 'strict', label: '严格问题导向' },
  { value: 'balanced', label: '平衡反馈' },
  { value: 'encouraging', label: '鼓励式反馈' },
];

export const specialConstraintOptions: Option<SpecialConstraint>[] = [
  { value: 'keep_original_style', label: '尽量保留原文风格' },
  { value: 'avoid_overwriting', label: '避免过度重写式建议' },
  { value: 'focus_publishability', label: '更关注可发布性' },
  { value: 'focus_literary_expression', label: '更关注文学表达' },
];
