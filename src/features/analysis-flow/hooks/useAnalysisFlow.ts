'use client';

import { useState } from 'react';
import { analysisService } from '@/services/analysis';
import type { AnalysisProgressUpdate } from '@/services/analysis/types';
import type { PublishedOpsConfig } from '@/server/config/types';
import { toAppErrorPayload } from '@/types/errors';
import type { AppFlowStep, AnalysisStatus } from '@/types/appFlow';
import type { ModelConfig } from '@/types/modelConfig';
import type { AnalysisReport, EvaluationInput } from '@/types/report';
import { requestCompiledInstructions } from '../lib/requestCompiledInstructions';

type UseAnalysisFlowOptions = {
  opsConfig: PublishedOpsConfig;
  currentModelConfig: ModelConfig | null;
  hasSelectedConfig: boolean;
  activeControlSelections: Record<string, string>;
  validate: () => EvaluationInput | null;
  setFormError: (message: string) => void;
  clearError: (key?: keyof EvaluationInput | 'form') => void;
  analysisStatus: AnalysisStatus;
  analysisMessage?: string;
  startAnalysis: () => void;
  updateAnalysisProgress: (update: AnalysisProgressUpdate) => void;
  markAnalysisFailed: (message: string, canRetry?: boolean) => void;
  resetAnalysisState: () => void;
  onRequireConfig: () => void;
};

export function useAnalysisFlow({
  opsConfig,
  currentModelConfig,
  hasSelectedConfig,
  activeControlSelections,
  validate,
  setFormError,
  clearError,
  analysisStatus,
  analysisMessage,
  startAnalysis,
  updateAnalysisProgress,
  markAnalysisFailed,
  resetAnalysisState,
  onRequireConfig,
}: UseAnalysisFlowOptions) {
  const [appStep, setAppStep] = useState<AppFlowStep>('input');
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [lastSubmittedInput, setLastSubmittedInput] = useState<EvaluationInput | null>(null);
  const [isOpsConfigStaleDialogOpen, setIsOpsConfigStaleDialogOpen] = useState(false);

  const runAnalysis = async (validatedInput: EvaluationInput) => {
    if (!hasSelectedConfig) {
      setFormError('请先添加一个 API 配置。');
      onRequireConfig();
      return;
    }

    if (!currentModelConfig) {
      setFormError('请选择一个模型');
      return;
    }

    startAnalysis();
    setLastSubmittedInput(validatedInput);
    setAppStep('analyzing');

    try {
      updateAnalysisProgress({
        stage: 'fetch-template',
        message: '正在同步当前分析配置',
      });
      const compiledInstructions = await requestCompiledInstructions({
        controlSelections: activeControlSelections,
        configVersion: opsConfig.manifest.configVersion,
      });

      const result = await analysisService.generateReport({
        input: validatedInput,
        modelConfig: currentModelConfig,
        instructionText: compiledInstructions.instructionText,
        onProgress: updateAnalysisProgress,
      });
      resetAnalysisState();
      setReport(result);
      setAppStep('report');
    } catch (error) {
      console.error('Analysis failed:', error);
      const payload = toAppErrorPayload(error, {
        code: 'unknown_error',
        message: '分析失败，请重试',
      });

      if (payload.code === 'ops_config_stale') {
        resetAnalysisState();
        setFormError(payload.message);
        setIsOpsConfigStaleDialogOpen(true);
        setAppStep('input');
        return;
      }

      if (payload.retryable) {
        markAnalysisFailed(payload.message, true);
        setAppStep('analyzing');
        return;
      }

      markAnalysisFailed(payload.message, false);
      setFormError(payload.message);
      setAppStep('input');
    }
  };

  const handleSubmit = async () => {
    const validatedInput = validate();
    if (!validatedInput) {
      return;
    }

    await runAnalysis(validatedInput);
  };

  const handleRetryAnalysis = async () => {
    if (!lastSubmittedInput) {
      setFormError('缺少可重试的分析输入，请返回后重新提交。');
      setAppStep('input');
      return;
    }

    await runAnalysis(lastSubmittedInput);
  };

  const handleBackToInput = () => {
    if (analysisStatus === 'failed' && analysisMessage) {
      setFormError(analysisMessage);
    }

    resetAnalysisState();
    setAppStep('input');
  };

  const handleReset = () => {
    setLastSubmittedInput(null);
    resetAnalysisState();
    setReport(null);
    clearError();
    setAppStep('input');
  };

  return {
    appStep,
    report,
    isOpsConfigStaleDialogOpen,
    setIsOpsConfigStaleDialogOpen,
    handleSubmit,
    handleRetryAnalysis,
    handleBackToInput,
    handleReset,
  };
}
