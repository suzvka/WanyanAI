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
import {
  evaluationGoalOptions,
  feedbackStyleOptions,
  readerPreferenceOptions,
  specialConstraintOptions,
  textCompletenessOptions,
  textTypeOptions,
} from '@/config/evaluationOptions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, Sparkles } from 'lucide-react';

interface AnalysisSettingsPanelProps {
  formData: EvaluationInput;
  errorMessage: string | null;
  onTextTypeChange: (value: TextType) => void;
  onTextCompletenessChange: (value: TextCompleteness) => void;
  onEvaluationGoalChange: (value: EvaluationGoal) => void;
  onReaderPreferenceChange: (value: ReaderPreference) => void;
  onFeedbackStyleChange: (value: FeedbackStyle) => void;
  onSpecialConstraintChange: (constraint: SpecialConstraint, checked: boolean) => void;
  onReferenceSampleChange: (checked: boolean) => void;
  onSubmit: () => void;
}

export default function AnalysisSettingsPanel({
  formData,
  errorMessage,
  onTextTypeChange,
  onTextCompletenessChange,
  onEvaluationGoalChange,
  onReaderPreferenceChange,
  onFeedbackStyleChange,
  onSpecialConstraintChange,
  onReferenceSampleChange,
  onSubmit,
}: AnalysisSettingsPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>分析设置</CardTitle>
        <CardDescription>配置您的分析偏好</CardDescription>
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
              <Select value={formData.textType} onValueChange={(value: string) => onTextTypeChange(value as TextType)}>
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
                onValueChange={(value: string) => onReaderPreferenceChange(value as ReaderPreference)}
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
                onValueChange={(value: string) => onFeedbackStyleChange(value as FeedbackStyle)}
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
                      onCheckedChange={(checked: boolean | 'indeterminate') => {
                        onSpecialConstraintChange(option.value, checked === true);
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
                onCheckedChange={(checked: boolean | 'indeterminate') => onReferenceSampleChange(checked === true)}
              />
              <Label htmlFor="reference-sample" className="text-sm cursor-pointer">
                提供参考样板
              </Label>
            </div>

            <Button className="w-full h-12 text-lg" onClick={onSubmit}>
              <Sparkles className="w-5 h-5 mr-2" />
              开始分析
            </Button>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
