'use client';

import { useState } from 'react';
import { createDefaultEvaluationInput } from '@/config/defaults';
import { EvaluationInput, SpecialConstraint } from '@/types/report';
import { AnalysisPhase } from '@/types/appFlow';
import { EvaluationFormErrors, validateEvaluationInput } from '@/lib/validation/evaluationInput';

export function useEvaluationForm(initialValue: EvaluationInput = createDefaultEvaluationInput()) {
  const [formData, setFormData] = useState<EvaluationInput>(initialValue);
  const [formErrors, setFormErrors] = useState<EvaluationFormErrors>({});
  const [analysisPhase, setAnalysisPhase] = useState<AnalysisPhase>('fetch-template');

  const clearError = (key?: keyof EvaluationFormErrors) => {
    setFormErrors((current: EvaluationFormErrors) => {
      if (!key) {
        return {};
      }

      if (!(key in current)) {
        return current;
      }

      const nextErrors = { ...current };
      delete nextErrors[key];
      return nextErrors;
    });
  };

  const updateField = <K extends keyof EvaluationInput>(key: K, value: EvaluationInput[K]) => {
    setFormData((current: EvaluationInput) => ({ ...current, [key]: value }));
    clearError(key);

    if (key === 'textContent') {
      clearError('form');
    }
  };

  const toggleSpecialConstraint = (constraint: SpecialConstraint, checked: boolean) => {
    const current = formData.specialConstraints || [];
    const nextConstraints = checked
      ? [...current, constraint]
      : current.filter((item: SpecialConstraint) => item !== constraint);

    updateField('specialConstraints', nextConstraints);
  };

  const validate = (): EvaluationInput | null => {
    const result = validateEvaluationInput(formData);

    if (result.success) {
      setFormData(result.data);
      setFormErrors({});
      return result.data;
    }

    setFormErrors(result.errors);
    return null;
  };

  const setFormError = (message: string) => {
    setFormErrors((current: EvaluationFormErrors) => ({
      ...current,
      form: message,
    }));
  };

  const startAnalysis = () => {
    clearError('form');
    setAnalysisPhase('fetch-template');
  };

  const updateAnalysisPhase = (phase: AnalysisPhase) => {
    setAnalysisPhase(phase);
  };

  const resetForm = () => {
    setFormData(createDefaultEvaluationInput());
    setFormErrors({});
    setAnalysisPhase('fetch-template');
  };

  return {
    formData,
    formErrors,
    analysisPhase,
    updateField,
    toggleSpecialConstraint,
    validate,
    setFormError,
    clearError,
    startAnalysis,
    updateAnalysisPhase,
    resetForm,
  };
}
