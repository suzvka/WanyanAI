'use client';

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { RefreshCw, Settings, Sparkles } from 'lucide-react';
import { EvaluationInput } from '@/types/report';
import ReportView from '@/components/ReportView';
import TextInputPanel from '@/components/home/TextInputPanel';
import AnalysisProgressView from '@/components/home/AnalysisProgressView';
import { useEvaluationForm } from '@/hooks/useEvaluationForm';
import type { PublishedOpsConfig } from '@/server/config/types';
import AnalysisControlsPanel from '@/features/analysis-controls/components/AnalysisControlsPanel';
import { useAnalysisControls } from '@/features/analysis-controls/hooks/useAnalysisControls';
import { useAnalysisFlow } from '@/features/analysis-flow/hooks/useAnalysisFlow';
import ApiConfigManagerDialog from '@/features/model-config/components/ApiConfigManagerDialog';
import ConfigSelector from '@/features/model-config/components/ConfigSelector';
import ConfigStatusBar from '@/features/model-config/components/ConfigStatusBar';
import ModelSelector from '@/features/model-config/components/ModelSelector';
import { useModelConfigController } from '@/features/model-config/hooks/useModelConfigController';

interface HomeClientProps {
  opsConfig: PublishedOpsConfig;
  initialEvaluationInput: EvaluationInput;
}

export default function HomeClient({ opsConfig, initialEvaluationInput }: HomeClientProps) {
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const { site, featureFlags } = opsConfig;
  const {
    formData,
    formErrors,
    updateField,
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
  } = useEvaluationForm(initialEvaluationInput, {
    featureFlags: opsConfig.featureFlags,
  });

  const {
    apiConfigs,
    selectedConfigId,
    selectedConfig,
    currentModelConfig,
    isModelRefreshing,
    isConfigBusy,
    refreshModels,
    createConfig,
    updateConfig,
    deleteConfig,
    selectConfig,
    selectModel,
  } = useModelConfigController({
    onConfigInteraction: () => clearError('form'),
  });

  const { dynamicControls, activeControlSelections, handleControlChange } = useAnalysisControls({
    opsConfig,
    formData,
    initialEvaluationInput,
    updateField,
    clearError,
  });

  const isSubmittingAnalysis = analysisStatus === 'running' || analysisStatus === 'recovering';
  const settingsDescription =
    dynamicControls.length > 0
      ? site.settingsPanel.description
      : opsConfig.source === 'fallback'
        ? '当前未加载动态分析配置，将使用系统默认值。'
        : '当前没有可配置的动态检查项，将直接使用当前默认分析参数。';

  const {
    appStep,
    report,
    isOpsConfigStaleDialogOpen,
    setIsOpsConfigStaleDialogOpen,
    handleSubmit,
    handleRetryAnalysis,
    handleBackToInput,
    handleReset,
  } = useAnalysisFlow({
    opsConfig,
    currentModelConfig,
    hasSelectedConfig: Boolean(selectedConfig),
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
    onRequireConfig: () => setIsConfigDialogOpen(true),
  });

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
                <h1 className="text-2xl font-bold text-slate-900">{site.home.title}</h1>
                <p className="text-sm text-slate-500">{site.home.subtitle}</p>
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-3 lg:max-w-3xl">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
                <ConfigSelector
                  configs={apiConfigs}
                  selectedConfigId={selectedConfigId}
                  disabled={isConfigBusy}
                  onSelect={selectConfig}
                />

                <ModelSelector
                  selectedConfig={selectedConfig}
                  disabled={isConfigBusy}
                  onSelectModel={selectModel}
                />

                <Button
                  type="button"
                  variant="outline"
                  disabled={!selectedConfig || isConfigBusy}
                  onClick={() => selectedConfig && refreshModels(selectedConfig.id)}
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${isModelRefreshing ? 'animate-spin' : ''}`} />
                  刷新模型
                </Button>

                <Button type="button" variant="outline" onClick={() => setIsConfigDialogOpen(true)}>
                  <Settings className="mr-2 h-4 w-4" />
                  管理配置
                </Button>
              </div>

              <ConfigStatusBar selectedConfig={selectedConfig} />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {appStep === 'input' ? (
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <TextInputPanel
                title={site.inputPanel.title}
                description={site.inputPanel.description}
                textBlocks={formData.textBlocks}
                enableFileUpload={featureFlags.enableFileUpload}
                enableAnnotations={featureFlags.enableAnnotations}
                onTextBlocksChange={(value) => updateField('textBlocks', value)}
              />
            </div>

            <div className="space-y-6">
              <AnalysisControlsPanel
                title={site.settingsPanel.title}
                description={settingsDescription}
                controls={dynamicControls}
                controlSelections={activeControlSelections}
                errorMessage={formErrors.form || formErrors.textBlocks || null}
                isSubmitting={isSubmittingAnalysis}
                onControlChange={handleControlChange}
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
              runningTitle={site.progress.runningTitle}
              runningDescription={site.progress.runningDescription}
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
        onSelectConfig={selectConfig}
        onCreateConfig={createConfig}
        onUpdateConfig={updateConfig}
        onDeleteConfig={deleteConfig}
      />

      <AlertDialog open={isOpsConfigStaleDialogOpen} onOpenChange={setIsOpsConfigStaleDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>页面配置已更新</AlertDialogTitle>
            <AlertDialogDescription>
              当前动态检查策略已发生变化。请先保存或复制当前输入内容，再手动刷新页面以加载最新配置。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setIsOpsConfigStaleDialogOpen(false)}>我知道了</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
