'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, Settings, Sparkles } from 'lucide-react';
import { AnalysisReport, EvaluationInput, FeedbackStyle, ReaderPreference, SpecialConstraint, TextBlock, TextCompleteness, TextType } from '@/types/report';
import { ApiConfigDraft, ApiConfigRecord, ModelConfig } from '@/types/modelConfig';
import { analysisService } from '@/services/analysis';
import { modelConfigService } from '@/services/modelConfig';
import ReportView from '@/components/ReportView';
import { AppFlowStep } from '@/types/appFlow';
import TextInputPanel from '@/components/home/TextInputPanel';
import AnalysisSettingsPanel from '@/components/home/AnalysisSettingsPanel';
import AnalysisProgressView from '@/components/home/AnalysisProgressView';
import ApiConfigManagerDialog from '@/components/home/ApiConfigManagerDialog';
import { useEvaluationForm } from '@/hooks/useEvaluationForm';
import { toAppErrorPayload } from '@/types/errors';
import type { CatalogOption, PublishedOpsConfig } from '@/server/config/types';

interface HomeClientProps {
  opsConfig: PublishedOpsConfig;
  initialEvaluationInput: EvaluationInput;
}

function getEnabledOptions<T extends string>(options: CatalogOption<T>[]) {
  return options.filter((option) => option.enabled).sort((left, right) => left.sortOrder - right.sortOrder);
}

function getConfigStatusLabel(status: ApiConfigRecord['lastValidationStatus']) {
  switch (status) {
    case 'valid':
      return '可用';
    case 'invalid':
      return '不可用';
    case 'validating':
      return '验证中';
    default:
      return '待验证';
  }
}

function getConfigStatusVariant(status: ApiConfigRecord['lastValidationStatus']) {
  switch (status) {
    case 'valid':
      return 'default';
    case 'invalid':
      return 'destructive';
    default:
      return 'outline';
  }
}

export default function HomeClient({ opsConfig, initialEvaluationInput }: HomeClientProps) {
  const [appStep, setAppStep] = useState<AppFlowStep>('input');
  const [apiConfigs, setApiConfigs] = useState<ApiConfigRecord[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [isConfigMutating, setIsConfigMutating] = useState(false);
  const [isModelRefreshing, setIsModelRefreshing] = useState(false);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [lastSubmittedInput, setLastSubmittedInput] = useState<EvaluationInput | null>(null);
  const {
    formData,
    formErrors,
    updateField,
    toggleSpecialConstraint,
    validate,
    setFormError,
    clearError,
    analysisPhase,
    analysisStatus,
    analysisMessage,
    canRetryAnalysis,
    startAnalysis,
    updateAnalysisProgress,
    markAnalysisFailed,
    resetAnalysisState,
    resetForm,
  } = useEvaluationForm(initialEvaluationInput, {
    featureFlags: opsConfig.featureFlags,
  });

  const textTypeOptions = getEnabledOptions(opsConfig.catalog.textTypes);
  const textCompletenessOptions = getEnabledOptions(opsConfig.catalog.textCompletenessOptions);
  const evaluationGoalOptions = getEnabledOptions(opsConfig.catalog.evaluationGoals);
  const readerPreferenceOptions = getEnabledOptions(opsConfig.catalog.readerPreferences);
  const feedbackStyleOptions = getEnabledOptions(opsConfig.catalog.feedbackStyles);
  const specialConstraintOptions = getEnabledOptions(opsConfig.catalog.specialConstraints);

  const selectedConfig = useMemo(
    () => apiConfigs.find((config: ApiConfigRecord) => config.id === selectedConfigId) || null,
    [apiConfigs, selectedConfigId],
  );

  const currentModelConfig: ModelConfig | null = selectedConfig?.selectedModel
    ? {
        baseUrl: selectedConfig.baseUrl,
        apiKey: selectedConfig.apiKey,
        selectedModel: selectedConfig.selectedModel,
      }
    : null;

  const isSubmittingAnalysis = analysisStatus === 'running' || analysisStatus === 'recovering';
  const isConfigBusy = isConfigMutating || isModelRefreshing;

  const syncConfigState = () => {
    setApiConfigs(modelConfigService.listConfigs());
    setSelectedConfigId(modelConfigService.getSelectedConfig()?.id || null);
  };

  useEffect(() => {
    syncConfigState();
  }, []);

  const refreshConfigModels = async (configId: string, showToast = true) => {
    setIsModelRefreshing(true);

    try {
      const refreshTask = modelConfigService.refreshModels(configId);
      syncConfigState();

      const result = await refreshTask;
      syncConfigState();

      if (showToast) {
        if (result.validation.success) {
          toast.success(result.config?.lastValidationMessage || 'API 配置校验成功。');
        } else {
          toast.error(result.validation.error?.message || 'API 配置校验失败。');
        }
      }

      return result;
    } catch (error) {
      const payload = toAppErrorPayload(error, {
        code: 'unknown_error',
        message: '模型列表刷新失败，请稍后重试。',
      });
      if (showToast) {
        toast.error(payload.message);
      }

      return {
        config: null,
        validation: {
          success: false,
          error: payload,
        },
      };
    } finally {
      setIsModelRefreshing(false);
      syncConfigState();
    }
  };

  const handleCreateConfig = async (value: ApiConfigDraft) => {
    setIsConfigMutating(true);

    try {
      const createdConfig = modelConfigService.createConfig(value);
      syncConfigState();
      clearError('form');
      await refreshConfigModels(createdConfig.id);
    } catch (error) {
      const payload = toAppErrorPayload(error, {
        code: 'config_invalid',
        message: '创建配置失败，请检查输入。',
      });
      toast.error(payload.message);
    } finally {
      setIsConfigMutating(false);
      syncConfigState();
    }
  };

  const handleUpdateConfig = async (configId: string, value: ApiConfigDraft) => {
    setIsConfigMutating(true);

    try {
      modelConfigService.updateConfig(configId, value);
      syncConfigState();
      clearError('form');
      await refreshConfigModels(configId);
    } catch (error) {
      const payload = toAppErrorPayload(error, {
        code: 'config_invalid',
        message: '更新配置失败，请检查输入。',
      });
      toast.error(payload.message);
    } finally {
      setIsConfigMutating(false);
      syncConfigState();
    }
  };

  const handleDeleteConfig = async (configId: string) => {
    setIsConfigMutating(true);

    try {
      modelConfigService.removeConfig(configId);
      syncConfigState();
      toast.success('API 配置已删除。');
    } catch (error) {
      const payload = toAppErrorPayload(error, {
        code: 'unknown_error',
        message: '删除配置失败，请重试。',
      });
      toast.error(payload.message);
    } finally {
      setIsConfigMutating(false);
      syncConfigState();
    }
  };

  const handleSelectConfig = async (configId: string) => {
    modelConfigService.selectConfig(configId);
    syncConfigState();
    clearError('form');
    await refreshConfigModels(configId);
  };

  const handleModelChange = (value: string) => {
    if (!selectedConfig) {
      return;
    }

    modelConfigService.saveSelectedModel(selectedConfig.id, value);
    clearError('form');
    syncConfigState();
  };

  const runAnalysis = async (validatedInput: EvaluationInput) => {
    if (!selectedConfig) {
      setFormError('请先添加一个 API 配置。');
      setIsConfigDialogOpen(true);
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
      const result = await analysisService.generateReport({
        input: validatedInput,
        modelConfig: currentModelConfig,
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

  if (appStep === 'report' && report) {
    return <ReportView report={report} onReset={handleReset} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-600 p-2">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{opsConfig.site.home.title}</h1>
                <p className="text-sm text-slate-500">{opsConfig.site.home.subtitle}</p>
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-3 lg:max-w-3xl">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
                <Select value={selectedConfigId || undefined} onValueChange={handleSelectConfig}>
                  <SelectTrigger disabled={isConfigBusy || apiConfigs.length === 0}>
                    <SelectValue placeholder={apiConfigs.length > 0 ? '切换 API 配置' : '暂无 API 配置'} />
                  </SelectTrigger>
                  <SelectContent>
                    {apiConfigs.map((config: ApiConfigRecord) => (
                      <SelectItem key={config.id} value={config.id}>
                        {config.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedConfig?.selectedModel || undefined} onValueChange={handleModelChange}>
                  <SelectTrigger disabled={isConfigBusy || !selectedConfig || selectedConfig.modelsCache.length === 0}>
                    <SelectValue placeholder={selectedConfig ? '请选择一个模型' : '请先选择 API 配置'} />
                  </SelectTrigger>
                  <SelectContent>
                    {(selectedConfig?.modelsCache || []).map((model: ApiConfigRecord['modelsCache'][number]) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  type="button"
                  variant="outline"
                  disabled={!selectedConfig || isConfigBusy}
                  onClick={() => selectedConfig && refreshConfigModels(selectedConfig.id)}
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${isModelRefreshing ? 'animate-spin' : ''}`} />
                  刷新模型
                </Button>

                <Button type="button" variant="outline" onClick={() => setIsConfigDialogOpen(true)}>
                  <Settings className="mr-2 h-4 w-4" />
                  管理配置
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                {selectedConfig ? (
                  <>
                    <Badge variant={getConfigStatusVariant(selectedConfig.lastValidationStatus)}>
                      {getConfigStatusLabel(selectedConfig.lastValidationStatus)}
                    </Badge>
                    <span className="max-w-[520px] truncate">
                      {selectedConfig.lastValidationMessage || `${selectedConfig.name} · 已缓存 ${selectedConfig.modelsCache.length} 个模型`}
                    </span>
                  </>
                ) : (
                  <span>当前尚未添加 API 配置。点击“管理配置”即可开始设置。</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {appStep === 'input' ? (
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <TextInputPanel
                title={opsConfig.site.inputPanel.title}
                description={opsConfig.site.inputPanel.description}
                textBlocks={formData.textBlocks}
                globalSupplementBlocks={formData.globalSupplementBlocks}
                enableFileUpload={opsConfig.featureFlags.enableFileUpload}
                enableGlobalSupplementBlocks={opsConfig.featureFlags.enableGlobalSupplementBlocks}
                enableLocalSupplements={opsConfig.featureFlags.enableLocalSupplements}
                onTextBlocksChange={(value) => updateField('textBlocks', value)}
                onGlobalSupplementBlocksChange={(value: TextBlock[]) => updateField('globalSupplementBlocks', value)}
              />
            </div>

            <div className="space-y-6">
              <AnalysisSettingsPanel
                title={opsConfig.site.settingsPanel.title}
                description={opsConfig.site.settingsPanel.description}
                formData={formData}
                textTypeOptions={textTypeOptions}
                textCompletenessOptions={textCompletenessOptions}
                evaluationGoalOptions={evaluationGoalOptions}
                readerPreferenceOptions={readerPreferenceOptions}
                feedbackStyleOptions={feedbackStyleOptions}
                specialConstraintOptions={specialConstraintOptions}
                featureFlags={opsConfig.featureFlags}
                errorMessage={formErrors.form || formErrors.textBlocks || formErrors.globalSupplementBlocks || null}
                isSubmitting={isSubmittingAnalysis}
                onTextTypeChange={(value: TextType) => updateField('textType', value)}
                onTextCompletenessChange={(value: TextCompleteness) => updateField('textCompleteness', value)}
                onEvaluationGoalChange={(value) => updateField('evaluationGoal', value)}
                onReaderPreferenceChange={(value: ReaderPreference) => updateField('readerPreference', value)}
                onFeedbackStyleChange={(value: FeedbackStyle) => updateField('feedbackStyle', value)}
                onSpecialConstraintChange={(constraint: SpecialConstraint, checked: boolean) =>
                  toggleSpecialConstraint(constraint, checked)
                }
                onSubmit={handleSubmit}
              />
            </div>
          </div>
        ) : (
          <AnalysisProgressView
            phase={analysisPhase}
            status={analysisStatus}
            message={analysisMessage}
            canRetry={canRetryAnalysis}
            runningTitle={opsConfig.site.progress.runningTitle}
            runningDescription={opsConfig.site.progress.runningDescription}
            onRetry={handleRetryAnalysis}
            onBack={handleBackToInput}
          />
        )}
      </main>

      <ApiConfigManagerDialog
        open={isConfigDialogOpen}
        selectedConfigId={selectedConfigId}
        configs={apiConfigs}
        busy={isConfigBusy}
        onOpenChange={setIsConfigDialogOpen}
        onSelectConfig={handleSelectConfig}
        onCreateConfig={handleCreateConfig}
        onUpdateConfig={handleUpdateConfig}
        onDeleteConfig={handleDeleteConfig}
      />
    </div>
  );
}
