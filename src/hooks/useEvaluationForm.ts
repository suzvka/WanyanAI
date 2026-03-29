'use client';

import { useState } from 'react';
import { EvaluationInput } from '@/types/report';
import { AnalysisPhase, AnalysisProgressState, AnalysisStatus } from '@/types/appFlow';
import { EvaluationFormErrors, validateEvaluationInput } from '@/lib/validation/evaluationInput';
import type { FeatureFlagsConfig } from '@/server/config/types';

const initialAnalysisProgressState: AnalysisProgressState = {
  phase: 'prepare-upload',
  status: 'idle',
  message: '分析准备就绪。',
  canRetry: false,
};

type UseEvaluationFormOptions = {
  featureFlags?: Partial<FeatureFlagsConfig>;
};

function cloneEvaluationInput(input: EvaluationInput): EvaluationInput {
  return {
    ...input,
    textBlocks: input.textBlocks.map((block) => ({
      ...block,
      content: block.content
        ? block.content.kind === 'text'
          ? { ...block.content }
          : { ...block.content, file: { ...block.content.file } }
        : null,
      annotations: block.annotations.map((annotation) => ({
        ...annotation,
        content: annotation.content
          ? annotation.content.kind === 'text'
            ? { ...annotation.content }
            : { ...annotation.content, file: { ...annotation.content.file } }
          : null,
      })),
    })),
  };
}

export function useEvaluationForm(
  initialValue: EvaluationInput,
  options: UseEvaluationFormOptions = {},
) {
  const [initialFormData] = useState<EvaluationInput>(() => cloneEvaluationInput(initialValue));
  const [formData, setFormData] = useState<EvaluationInput>(initialFormData);
  const [formErrors, setFormErrors] = useState<EvaluationFormErrors>({});
  const [analysisProgress, setAnalysisProgress] = useState<AnalysisProgressState>(initialAnalysisProgressState);

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

    if (key === 'textBlocks') {
      clearError('form');
    }
  };

  const validate = (): EvaluationInput | null => {
    const result = validateEvaluationInput(formData, options);

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
    setAnalysisProgress({
      phase: 'prepare-upload',
      status: 'running',
      message: '正在准备分析任务。',
      canRetry: false,
    });
  };

  const updateAnalysisProgress = ({
    stage,
    message,
    status,
  }: {
    stage: AnalysisPhase;
    message?: string;
    status?: Extract<AnalysisStatus, 'running' | 'recovering'>;
  }) => {
    setAnalysisProgress((current: AnalysisProgressState) => ({
      phase: stage,
      status: status ?? 'running',
      message: message ?? current.message,
      canRetry: false,
    }));
  };

  const markAnalysisFailed = (message: string, canRetry = false) => {
    setAnalysisProgress((current: AnalysisProgressState) => ({
      ...current,
      status: 'failed',
      message,
      canRetry,
    }));
  };

  const resetAnalysisState = () => {
    setAnalysisProgress(initialAnalysisProgressState);
  };

  const resetForm = () => {
    setFormData(cloneEvaluationInput(initialFormData));
    setFormErrors({});
    setAnalysisProgress(initialAnalysisProgressState);
  };

  return {
    formData,
    formErrors,
    analysisPhase: analysisProgress.phase,
    analysisStatus: analysisProgress.status,
    analysisMessage: analysisProgress.message,
    canRetryAnalysis: analysisProgress.canRetry,
    updateField,
    validate,
    setFormError,
    clearError,
    startAnalysis,
    updateAnalysisProgress,
    markAnalysisFailed,
    resetAnalysisState,
    resetForm,
  };
}
