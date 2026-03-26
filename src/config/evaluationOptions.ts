import {
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
