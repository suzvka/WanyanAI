export {
  evaluationGoalOptions,
  textCompletenessOptions,
  textTypeOptions,
} from '@/config/evaluationDimensions';

export type Option<T extends string> = {
  value: T;
  label: string;
};

export function getOptionLabel<T extends string>(options: Option<T>[], value: T): string {
  return options.find((option) => option.value === value)?.label || value;
}
