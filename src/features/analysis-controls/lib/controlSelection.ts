import type {
  AnalysisControlConfig,
  PublishedOpsConfig,
} from '@/server/config/types';
import type { EvaluationInput } from '@/types/report';
import {
  readBoundControlValue,
  writeBoundControlValue,
  type EvaluationInputUpdater,
} from './controlBindings';

export type { EvaluationInputUpdater } from './controlBindings';

export function getEnabledDynamicControls(
  opsConfig: PublishedOpsConfig,
  evaluationGoal: EvaluationInput['evaluationGoal'],
) {
  return opsConfig.analysisControls.controls
    .filter((control) => control.enabled && control.appliesTo.includes(evaluationGoal))
    .map((control) => ({
      ...control,
      options: control.options.filter((option) => option.enabled),
    }))
    .filter((control) => control.options.length > 0);
}

export function getBoundControlValue(control: AnalysisControlConfig, input: EvaluationInput): string | null {
  return control.bindTo ? readBoundControlValue(control.bindTo, input) : null;
}

export function resolveControlSelectionValue(
  control: AnalysisControlConfig,
  currentValue: string | undefined,
  input: EvaluationInput,
) {
  if (currentValue && control.options.some((option) => option.value === currentValue)) {
    return currentValue;
  }

  const boundValue = getBoundControlValue(control, input);
  return boundValue && control.options.some((option) => option.value === boundValue)
    ? boundValue
    : control.options[0].value;
}

export function resolveInitialControlSelections(
  controls: AnalysisControlConfig[],
  input: EvaluationInput,
) {
  return Object.fromEntries(
    controls.map((control) => [control.id, resolveControlSelectionValue(control, undefined, input)]),
  );
}

export function synchronizeControlSelections(
  controls: AnalysisControlConfig[],
  currentSelections: Record<string, string>,
  input: EvaluationInput,
) {
  let changed = Object.keys(currentSelections).length !== controls.length;
  const nextSelections: Record<string, string> = {};

  controls.forEach((control) => {
    const selectedValue = resolveControlSelectionValue(control, currentSelections[control.id], input);
    nextSelections[control.id] = selectedValue;

    if (selectedValue !== currentSelections[control.id]) {
      changed = true;
    }
  });

  return {
    changed,
    nextSelections,
  };
}

export function buildActiveControlSelections(
  controls: AnalysisControlConfig[],
  controlSelections: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    controls.map((control) => [control.id, controlSelections[control.id] || control.options[0].value]),
  );
}

export function applyBoundControlSelection(
  control: AnalysisControlConfig | undefined,
  value: string,
  updateField: EvaluationInputUpdater,
) {
  if (!control?.bindTo) {
    return;
  }

  writeBoundControlValue(control.bindTo, value, updateField);
}
