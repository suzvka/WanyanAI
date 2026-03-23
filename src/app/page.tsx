'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  FileText, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Settings,
  LogOut
} from 'lucide-react';
import { EvaluationInput, SpecialConstraint, AnalysisReport } from '@/types/report';
import { ModelConfig } from '@/types/modelConfig';
import { aiAnalysisService } from '@/services/aiAnalysis';
import { modelConfigService } from '@/services/modelConfig';
import ReportView from '@/components/ReportView';
import ModelConfigForm from '@/components/ModelConfigForm';

type AppStep = 'config' | 'input' | 'analyzing' | 'report';

export default function Home() {
  const [appStep, setAppStep] = useState<AppStep>('config');
  const [modelConfig, setModelConfig] = useState<ModelConfig | null>(null);
  const [step, setStep] = useState<'input' | 'analyzing' | 'report'>('input');
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [formData, setFormData] = useState<EvaluationInput>({
    textContent: '',
    textType: 'general_text',
    textCompleteness: 'excerpt',
    evaluationGoal: 'overall_check',
    readerPreference: 'general_reader',
    feedbackStyle: 'balanced',
    hasReferenceSample: false,
    specialConstraints: []
  });

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
    setAppStep('input');
  };

  const handleLogout = () => {
    modelConfigService.clearConfig();
    setModelConfig(null);
    setAppStep('config');
    setStep('input');
    setReport(null);
  };

  const textTypeOptions = [
    { value: 'web_serial', label: '网络连载' },
    { value: 'short_story', label: '短篇小说' },
    { value: 'light_novel', label: '轻小说/青年向' },
    { value: 'literary_submission', label: '文学投稿' },
    { value: 'general_text', label: '通用文本' }
  ];

  const textCompletenessOptions = [
    { value: 'complete', label: '完整作品' },
    { value: 'single_chapter', label: '长篇中的单章/样章' },
    { value: 'first_chapters', label: '长篇前若干章' },
    { value: 'excerpt', label: '节选片段' },
    { value: 'draft', label: '未完成草稿' }
  ];

  const evaluationGoalOptions = [
    { value: 'overall_check', label: '发布前总体检查' },
    { value: 'opening_attraction', label: '开篇吸引力检查' },
    { value: 'rhythm_progression', label: '节奏与推进问题' },
    { value: 'character_development', label: '人物塑造检查' },
    { value: 'style_consistency', label: '文风一致性检查' },
    { value: 'structure_completeness', label: '结构完整性检查' },
    { value: 'reader_acceptance', label: '读者接受度预估' }
  ];

  const readerPreferenceOptions = [
    { value: 'fast_paced', label: '偏快节奏' },
    { value: 'plot_driven', label: '偏剧情推进' },
    { value: 'character_emotion', label: '偏人物情感' },
    { value: 'world_building', label: '偏世界观/设定' },
    { value: 'literary_expression', label: '偏文学表达' },
    { value: 'general_reader', label: '通用读者' }
  ];

  const feedbackStyleOptions = [
    { value: 'strict', label: '严格问题导向' },
    { value: 'balanced', label: '平衡反馈' },
    { value: 'encouraging', label: '鼓励式反馈' }
  ];

  const specialConstraintOptions: { value: SpecialConstraint; label: string }[] = [
    { value: 'keep_original_style', label: '尽量保留原文风格' },
    { value: 'avoid_overwriting', label: '避免过度重写式建议' },
    { value: 'focus_publishability', label: '更关注可发布性' },
    { value: 'focus_literary_expression', label: '更关注文学表达' }
  ];

  const handleSubmit = async () => {
    if (!formData.textContent.trim()) {
      alert('请输入要分析的文本内容');
      return;
    }

    setStep('analyzing');
    
    try {
      const result = await aiAnalysisService.generateReport(formData);
      setReport(result);
      setStep('report');
    } catch (error) {
      console.error('Analysis failed:', error);
      alert('分析失败，请重试');
      setStep('input');
    }
  };

  const handleReset = () => {
    setStep('input');
    setReport(null);
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
  if (step === 'report' && report) {
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
        {step === 'input' ? (
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    文本内容
                  </CardTitle>
                  <CardDescription>
                    请粘贴您要分析的作品内容
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="在此粘贴您的文本内容..."
                    className="min-h-[400px] font-serif text-lg leading-relaxed"
                    value={formData.textContent}
                    onChange={(e) => setFormData({ ...formData, textContent: e.target.value })}
                  />
                  <p className="text-sm text-slate-500 mt-2">
                    字符数: {formData.textContent.length}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>分析设置</CardTitle>
                  <CardDescription>
                    配置您的分析偏好
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[700px] pr-4">
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <Label className="text-base font-medium">文本类型 *</Label>
                        <Select
                          value={formData.textType}
                          onValueChange={(value) => setFormData({ ...formData, textType: value as any })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {textTypeOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-3">
                        <Label className="text-base font-medium">文本完整度 *</Label>
                        <Select
                          value={formData.textCompleteness}
                          onValueChange={(value) => setFormData({ ...formData, textCompleteness: value as any })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {textCompletenessOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-3">
                        <Label className="text-base font-medium">本次评价目标 *</Label>
                        <Select
                          value={formData.evaluationGoal}
                          onValueChange={(value) => setFormData({ ...formData, evaluationGoal: value as any })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {evaluationGoalOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <Separator />

                      <div className="space-y-3">
                        <Label className="text-base font-medium">目标读者偏好</Label>
                        <RadioGroup
                          value={formData.readerPreference}
                          onValueChange={(value) => setFormData({ ...formData, readerPreference: value as any })}
                          className="grid grid-cols-2 gap-2"
                        >
                          {readerPreferenceOptions.map((option) => (
                            <div key={option.value} className="flex items-center space-x-2">
                              <RadioGroupItem value={option.value} id={`reader-${option.value}`} />
                              <Label htmlFor={`reader-${option.value}`} className="text-sm cursor-pointer">
                                {option.label}
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </div>

                      <div className="space-y-3">
                        <Label className="text-base font-medium">反馈风格</Label>
                        <RadioGroup
                          value={formData.feedbackStyle}
                          onValueChange={(value) => setFormData({ ...formData, feedbackStyle: value as any })}
                          className="grid grid-cols-1 gap-2"
                        >
                          {feedbackStyleOptions.map((option) => (
                            <div key={option.value} className="flex items-center space-x-2">
                              <RadioGroupItem value={option.value} id={`feedback-${option.value}`} />
                              <Label htmlFor={`feedback-${option.value}`} className="text-sm cursor-pointer">
                                {option.label}
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </div>

                      <div className="space-y-3">
                        <Label className="text-base font-medium">特殊约束</Label>
                        <div className="space-y-2">
                          {specialConstraintOptions.map((option) => (
                            <div key={option.value} className="flex items-center space-x-2">
                              <Checkbox
                                id={`constraint-${option.value}`}
                                checked={formData.specialConstraints?.includes(option.value)}
                                onCheckedChange={(checked) => {
                                  const current = formData.specialConstraints || [];
                                  const newConstraints = checked
                                    ? [...current, option.value]
                                    : current.filter(c => c !== option.value);
                                  setFormData({ ...formData, specialConstraints: newConstraints });
                                }}
                              />
                              <Label htmlFor={`constraint-${option.value}`} className="text-sm cursor-pointer">
                                {option.label}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="reference-sample"
                          checked={formData.hasReferenceSample}
                          onCheckedChange={(checked) => setFormData({ ...formData, hasReferenceSample: checked as boolean })}
                        />
                        <Label htmlFor="reference-sample" className="text-sm cursor-pointer">
                          提供参考样板
                        </Label>
                      </div>

                      <Button 
                        className="w-full h-12 text-lg" 
                        onClick={handleSubmit}
                      >
                        <Sparkles className="w-5 h-5 mr-2" />
                        开始分析
                      </Button>
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">AI 正在分析您的文本...</h2>
              <p className="text-slate-600 max-w-md mx-auto">
                正在进行多维度文本质量评估，请稍候片刻
              </p>
            </div>

            <div className="w-full max-w-md space-y-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <span className="text-slate-700">基础分析完成</span>
              </div>
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                <span className="text-slate-700">情境化评估中...</span>
              </div>
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-slate-300" />
                <span className="text-slate-400">生成结构化报告</span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
