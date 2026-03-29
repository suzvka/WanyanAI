import type { EvaluationInput } from '@/types/report';

export type EvaluationInputUpdater = <K extends keyof EvaluationInput>(
  key: K,
  value: EvaluationInput[K],
) => void;

type BoundControlId = 'text_type' | 'text_completeness' | 'evaluation_goal';

type ControlBindingAdapter = {
  read: (input: EvaluationInput) => string;
  write: (updateField: EvaluationInputUpdater, value: string) => void;
};

const controlBindingAdapters: Record<BoundControlId, ControlBindingAdapter> = {
  text_type: {
    read: (input) => input.textType,
    write: (updateField, value) => updateField('textType', value as EvaluationInput['textType']),
  },
  text_completeness: {
    read: (input) => input.textCompleteness,
    write: (updateField, value) => updateField('textCompleteness', value as EvaluationInput['textCompleteness']),
  },
  evaluation_goal: {
    read: (input) => input.evaluationGoal,
    write: (updateField, value) => updateField('evaluationGoal', value as EvaluationInput['evaluationGoal']),
  },
};

export function readBoundControlValue(controlId: string, input: EvaluationInput): string | null {
  const adapter = controlBindingAdapters[controlId as BoundControlId];
  return adapter ? adapter.read(input) : null;
}

export function writeBoundControlValue(
  controlId: string,
  value: string,
  updateField: EvaluationInputUpdater,
) {
  const adapter = controlBindingAdapters[controlId as BoundControlId];
  adapter?.write(updateField, value);
}
