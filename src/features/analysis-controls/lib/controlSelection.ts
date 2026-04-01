import type {
  AnalysisControlGroupConfig,
  AnalysisControlConfig,
} from '@/server/config/types';
import type { ModuleConfig } from '@/types/module';
import type { EvaluationInput } from '@/types/report';
import {
  readBoundControlValue,
  writeBoundControlValue,
  type EvaluationInputUpdater,
} from './controlBindings';
import {
  textTypeLabels,
  textCompletenessLabels,
  evaluationGoalLabels,
} from '@/config/evaluationDimensions';

export type { EvaluationInputUpdater } from './controlBindings';

function normalizeControl(control: AnalysisControlConfig): AnalysisControlConfig {
  return {
    ...control,
    options: control.options.filter((option) => option.enabled),
  };
}

export function getEnabledDynamicControlGroups(moduleConfig: ModuleConfig): AnalysisControlGroupConfig[] {
  return moduleConfig.analysisControls.groups
    .filter((group) => group.enabled)
    .map((group: AnalysisControlGroupConfig) => ({
      ...group,
      controls: group.controls
        .filter((control) => control.enabled)
        .map(normalizeControl)
        .filter((control) => control.options.length > 0),
    }));
}

export function getEnabledDynamicControls(
  moduleConfig: ModuleConfig,
): AnalysisControlConfig[] {
  return getEnabledDynamicControlGroups(moduleConfig)
    .flatMap((group) => group.controls)
    .filter((control) => control.options.length > 0);
}

export function getBoundControlValue(control: AnalysisControlConfig, input: EvaluationInput): string | null {
  return readBoundControlValue(control.id, input);
}

export function resolveControlSelectionValue(
  control: AnalysisControlConfig,
  currentValue: string | undefined,
  input: EvaluationInput,
) {
  if (control.options.length === 0) {
    return '';
  }

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
    controls
      .filter((control) => control.options.length > 0)
      .map((control) => [control.id, controlSelections[control.id] || control.options[0].value]),
  );
}

function getBoundControlOptionLabel(
  controls: AnalysisControlConfig[],
  controlId: string,
  input: EvaluationInput,
) {
  const control = controls.find((item) => item.id === controlId);

  if (!control) {
    return null;
  }

  const value = readBoundControlValue(controlId, input);
  const option = control.options.find((item) => item.enabled && item.value === value);

  if (!option) {
    return null;
  }

  return option.label;
}

export function resolveBoundControlLabels(moduleConfig: ModuleConfig, input: EvaluationInput) {
  const controls = getEnabledDynamicControls(moduleConfig);
  const textTypeLabel = getBoundControlOptionLabel(controls, 'text_type', input) ?? '未设置';
  const textCompletenessLabel = getBoundControlOptionLabel(controls, 'text_completeness', input) ?? '未设置';
  const evaluationGoalLabel = getBoundControlOptionLabel(controls, 'evaluation_goal', input) ?? '未设置';

  return {
    textTypeLabel,
    textCompletenessLabel,
    evaluationGoalLabel,
  };
}

export function applyBoundControlSelection(
  control: AnalysisControlConfig | undefined,
  value: string,
  updateField: EvaluationInputUpdater,
) {
  if (!control) {
    return;
  }

  writeBoundControlValue(control.id, value, updateField);
}
