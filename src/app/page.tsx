'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Sparkles, 
  Settings,
  LogOut
} from 'lucide-react';
import {
  AnalysisReport,
  EvaluationGoal,
  FeedbackStyle,
  ReaderPreference,
  SpecialConstraint,
  TextCompleteness,
  TextType,
} from '@/types/report';
import { ModelConfig } from '@/types/modelConfig';
import { analysisService } from '@/services/analysis';
import { modelConfigService } from '@/services/modelConfig';
import ReportView from '@/components/ReportView';
import ModelConfigForm from '@/components/ModelConfigForm';
import { AppFlowStep } from '@/types/appFlow';
import TextInputPanel from '@/components/home/TextInputPanel';
import AnalysisSettingsPanel from '@/components/home/AnalysisSettingsPanel';
import AnalysisProgressView from '@/components/home/AnalysisProgressView';
import { useEvaluationForm } from '@/hooks/useEvaluationForm';

export default function Home() {
  const [appStep, setAppStep] = useState<AppFlowStep>('config');
  const [modelConfig, setModelConfig] = useState<ModelConfig | null>(null);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const {
    formData,
    formErrors,
    updateField,
    toggleSpecialConstraint,
    validate,
    setFormError,
    clearError,
    resetForm,
  } = useEvaluationForm();

  // 检查是否已有配置
  useEffect(() => {
    const savedConfig = modelConfigService.getConfig();
    if (savedConfig) {
      setModelConfig(savedConfig);
      setAppStep('input');
    }
  }, []);

  const handleConfigSaved = (config: ModelConfig) => {
    setModelConfig(config);
    clearError();
    setAppStep('input');
  };

  const handleLogout = () => {
    modelConfigService.clearConfig();
    setModelConfig(null);
    resetForm();
    setReport(null);
    setAppStep('config');
  };

  const handleSubmit = async () => {
    const validatedInput = validate();
    if (!validatedInput) {
      return;
    }

    setAppStep('analyzing');
    
    try {
      const result = await analysisService.generateReport(validatedInput);
      setReport(result);
      setAppStep('report');
    } catch (error) {
      console.error('Analysis failed:', error);
      setFormError('分析失败，请重试');
      setAppStep('input');
    }
  };

  const handleReset = () => {
    setReport(null);
    clearError();
    setAppStep('input');
  };

  // 如果是配置页面，显示配置表单
  if (appStep === 'config') {
    return (
      <ModelConfigForm 
        onConfigSaved={handleConfigSaved}
        initialConfig={modelConfig}
      />
    );
  }

  // 如果是报告页面，显示报告
  if (appStep === 'report' && report) {
    return <ReportView report={report} onReset={handleReset} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">AI 文本完成度诊断系统</h1>
                <p className="text-sm text-slate-500">投稿/发布前的专业文本质量评估</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {modelConfig && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Settings className="w-4 h-4" />
                  <span className="truncate max-w-[200px]">{modelConfig.selectedModel}</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleLogout}
                    className="text-slate-500 hover:text-red-600"
                  >
                    <LogOut className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {appStep === 'input' ? (
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <TextInputPanel
                textContent={formData.textContent}
                onTextContentChange={(value) => updateField('textContent', value)}
              />
            </div>

            <div className="space-y-6">
              <AnalysisSettingsPanel
                formData={formData}
                errorMessage={formErrors.form || formErrors.textContent || null}
                onTextTypeChange={(value: TextType) => updateField('textType', value)}
                onTextCompletenessChange={(value: TextCompleteness) => updateField('textCompleteness', value)}
                onEvaluationGoalChange={(value: EvaluationGoal) => updateField('evaluationGoal', value)}
                onReaderPreferenceChange={(value: ReaderPreference) => updateField('readerPreference', value)}
                onFeedbackStyleChange={(value: FeedbackStyle) => updateField('feedbackStyle', value)}
                onSpecialConstraintChange={(constraint: SpecialConstraint, checked: boolean) =>
                  toggleSpecialConstraint(constraint, checked)
                }
                onReferenceSampleChange={(checked: boolean) => updateField('hasReferenceSample', checked)}
                onSubmit={handleSubmit}
              />
            </div>
          </div>
        ) : (
          <AnalysisProgressView />
        )}
      </main>
    </div>
  );
}
