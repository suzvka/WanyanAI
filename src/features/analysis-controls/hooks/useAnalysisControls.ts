'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AnalysisControlConfig, PublishedOpsConfig } from '@/server/config/types';
import type { EvaluationInput } from '@/types/report';
import {
  applyBoundControlSelection,
  buildActiveControlSelections,
  getBoundControlValue,
  getEnabledDynamicControls,
  resolveInitialControlSelections,
  synchronizeControlSelections,
  type EvaluationInputUpdater,
} from '../lib/controlSelection';

type UseAnalysisControlsOptions = {
  opsConfig: PublishedOpsConfig;
  formData: EvaluationInput;
  initialEvaluationInput: EvaluationInput;
  updateField: EvaluationInputUpdater;
  clearError: (key?: keyof EvaluationInput | 'form') => void;
};

export function useAnalysisControls({
  opsConfig,
  formData,
  initialEvaluationInput,
  updateField,
  clearError,
}: UseAnalysisControlsOptions) {
  const [controlSelections, setControlSelections] = useState<Record<string, string>>(() =>
    resolveInitialControlSelections(
      getEnabledDynamicControls(opsConfig, initialEvaluationInput.evaluationGoal),
      initialEvaluationInput,
    ),
  );

  const dynamicControls = useMemo(
    () => getEnabledDynamicControls(opsConfig, formData.evaluationGoal),
    [formData.evaluationGoal, opsConfig],
  );

  useEffect(() => {
    setControlSelections((current: Record<string, string>) => {
      const { changed, nextSelections } = synchronizeControlSelections(dynamicControls, current, formData);
      return changed ? nextSelections : current;
    });
  }, [dynamicControls, formData]);

  useEffect(() => {
    dynamicControls.forEach((control: AnalysisControlConfig) => {
      const selectedValue = controlSelections[control.id];
      if (!selectedValue) {
        return;
      }

      if (getBoundControlValue(control, formData) !== selectedValue) {
        applyBoundControlSelection(control, selectedValue, updateField);
      }
    });
  }, [controlSelections, dynamicControls, formData, updateField]);

  const activeControlSelections = useMemo<Record<string, string>>(
    () => buildActiveControlSelections(dynamicControls, controlSelections),
    [controlSelections, dynamicControls],
  );

  const handleControlChange = (controlId: string, value: string) => {
    const control = dynamicControls.find((item: AnalysisControlConfig) => item.id === controlId);

    setControlSelections((current: Record<string, string>) => ({
      ...current,
      [controlId]: value,
    }));
    applyBoundControlSelection(control, value, updateField);
    clearError('form');
  };

  return {
    dynamicControls,
    activeControlSelections,
    handleControlChange,
  };
}
