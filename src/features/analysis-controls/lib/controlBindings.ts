import type { AnalysisControlBinding } from '@/server/config/types';
import type { EvaluationInput } from '@/types/report';

export type EvaluationInputUpdater = <K extends keyof EvaluationInput>(
  key: K,
  value: EvaluationInput[K],
) => void;

type ControlBindingAdapter = {
  read: (input: EvaluationInput) => string;
  write: (updateField: EvaluationInputUpdater, value: string) => void;
};

const controlBindingAdapters: Record<AnalysisControlBinding, ControlBindingAdapter> = {
  textType: {
    read: (input) => input.textType,
    write: (updateField, value) => updateField('textType', value as EvaluationInput['textType']),
  },
  textCompleteness: {
    read: (input) => input.textCompleteness,
    write: (updateField, value) => updateField('textCompleteness', value as EvaluationInput['textCompleteness']),
  },
  evaluationGoal: {
    read: (input) => input.evaluationGoal,
    write: (updateField, value) => updateField('evaluationGoal', value as EvaluationInput['evaluationGoal']),
  },
};

export function readBoundControlValue(binding: AnalysisControlBinding, input: EvaluationInput): string {
  return controlBindingAdapters[binding].read(input);
}

export function writeBoundControlValue(
  binding: AnalysisControlBinding,
  value: string,
  updateField: EvaluationInputUpdater,
) {
  controlBindingAdapters[binding].write(updateField, value);
}
