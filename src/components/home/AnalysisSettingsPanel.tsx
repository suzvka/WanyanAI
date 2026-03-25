'use client';

import {
  EvaluationGoal,
  EvaluationInput,
  FeedbackStyle,
  ReaderPreference,
  SpecialConstraint,
  TextCompleteness,
  TextType,
} from '@/types/report';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, Loader2, Sparkles } from 'lucide-react';
import type { CatalogOption, FeatureFlagsConfig } from '@/server/config/types';

interface AnalysisSettingsPanelProps {
  title?: string;
  description?: string;
  formData: EvaluationInput;
  textTypeOptions: CatalogOption<TextType>[];
  textCompletenessOptions: CatalogOption<TextCompleteness>[];
  evaluationGoalOptions: CatalogOption<EvaluationGoal>[];
  readerPreferenceOptions: CatalogOption<ReaderPreference>[];
  feedbackStyleOptions: CatalogOption<FeedbackStyle>[];
  specialConstraintOptions: CatalogOption<SpecialConstraint>[];
  featureFlags: FeatureFlagsConfig;
  errorMessage: string | null;
  isSubmitting: boolean;
  submitHint?: string;
  onTextTypeChange: (value: TextType) => void;
  onTextCompletenessChange: (value: TextCompleteness) => void;
  onEvaluationGoalChange: (value: EvaluationGoal) => void;
  onReaderPreferenceChange: (value: ReaderPreference) => void;
  onFeedbackStyleChange: (value: FeedbackStyle) => void;
  onSpecialConstraintChange: (constraint: SpecialConstraint, checked: boolean) => void;
  onSubmit: () => void;
}

export default function AnalysisSettingsPanel({
  title = '分析设置',
  description = '配置您的分析偏好',
  formData,
  textTypeOptions,
  textCompletenessOptions,
  evaluationGoalOptions,
  readerPreferenceOptions,
  feedbackStyleOptions,
  specialConstraintOptions,
  featureFlags,
  errorMessage,
  isSubmitting,
  submitHint = '系统会自动校验模型输出；若检测到 JSON 结构异常，会自动尝试修复一次。',
  onTextTypeChange,
  onTextCompletenessChange,
  onEvaluationGoalChange,
  onReaderPreferenceChange,
  onFeedbackStyleChange,
  onSpecialConstraintChange,
  onSubmit,
}: AnalysisSettingsPanelProps) {
  const showReaderPreference = featureFlags.enableReaderPreference && readerPreferenceOptions.length > 0;
  const showFeedbackStyle = featureFlags.enableFeedbackStyle && feedbackStyleOptions.length > 0;
  const showSpecialConstraints = featureFlags.enableSpecialConstraints && specialConstraintOptions.length > 0;
  const showOptionalSections = showReaderPreference || showFeedbackStyle || showSpecialConstraints;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[700px] pr-4">
          <div className="space-y-6">
            {errorMessage && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>请检查输入</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-3">
              <Label className="text-base font-medium">文本类型 *</Label>
              <Select
                value={formData.textType}
                onValueChange={(value: string) => onTextTypeChange(value as TextType)}
                disabled={isSubmitting}
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
                onValueChange={(value: string) => onTextCompletenessChange(value as TextCompleteness)}
                disabled={isSubmitting}
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
                onValueChange={(value: string) => onEvaluationGoalChange(value as EvaluationGoal)}
                disabled={isSubmitting}
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
            {showOptionalSections && <Separator />}

            {showReaderPreference && (
              <div className="space-y-3">
                <Label className="text-base font-medium">目标读者偏好</Label>
                <RadioGroup
                  value={formData.readerPreference}
                  onValueChange={(value: string) => onReaderPreferenceChange(value as ReaderPreference)}
                  className="grid grid-cols-2 gap-2"
                  disabled={isSubmitting}
                >
                  {readerPreferenceOptions.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <RadioGroupItem value={option.value} id={`reader-${option.value}`} />
                      <Label htmlFor={`reader-${option.value}`} className="cursor-pointer text-sm">
                        {option.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            )}

            {showFeedbackStyle && (
              <div className="space-y-3">
                <Label className="text-base font-medium">反馈风格</Label>
                <RadioGroup
                  value={formData.feedbackStyle}
                  onValueChange={(value: string) => onFeedbackStyleChange(value as FeedbackStyle)}
                  className="grid grid-cols-1 gap-2"
                  disabled={isSubmitting}
                >
                  {feedbackStyleOptions.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <RadioGroupItem value={option.value} id={`feedback-${option.value}`} />
                      <Label htmlFor={`feedback-${option.value}`} className="cursor-pointer text-sm">
                        {option.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            )}

            {showSpecialConstraints && (
              <div className="space-y-3">
                <Label className="text-base font-medium">特殊约束</Label>
                <div className="space-y-2">
                  {specialConstraintOptions.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`constraint-${option.value}`}
                        checked={formData.specialConstraints?.includes(option.value)}
                        disabled={isSubmitting}
                        onCheckedChange={(checked: boolean | 'indeterminate') => {
                          onSpecialConstraintChange(option.value, checked === true);
                        }}
                      />
                      <Label htmlFor={`constraint-${option.value}`} className="cursor-pointer text-sm">
                        {option.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Alert>
              <Sparkles className="h-4 w-4" />
              <AlertTitle>可靠性增强</AlertTitle>
              <AlertDescription>{submitHint}</AlertDescription>
            </Alert>

            <div className="grid gap-3 sm:grid-cols-1">
              <Button className="h-12 text-lg" onClick={onSubmit} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
                {isSubmitting ? '分析进行中...' : '开始分析'}
              </Button>
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
