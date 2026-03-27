'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Loader2, Sparkles } from 'lucide-react';
import type { AnalysisControlConfig } from '@/server/config/types';

type AnalysisControlsPanelProps = {
  title?: string;
  description?: string;
  controls: AnalysisControlConfig[];
  controlSelections: Record<string, string>;
  errorMessage: string | null;
  isSubmitting: boolean;
  emptyStateMessage?: string;
  submitHint?: string;
  onControlChange: (controlId: string, value: string) => void;
  onSubmit: () => void;
};

export default function AnalysisControlsPanel({
  title = '分析设置',
  description = '配置您的分析偏好',
  controls,
  controlSelections,
  errorMessage,
  isSubmitting,
  emptyStateMessage = '当前没有可配置的动态检查项，本次分析将使用系统默认值。',
  submitHint = '系统会自动校验模型输出；若检测到 JSON 结构异常，会自动尝试修复一次。',
  onControlChange,
  onSubmit,
}: AnalysisControlsPanelProps) {
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

            {controls.length > 0 ? (
              controls.map((control) => (
                <div key={control.id} className="space-y-3">
                  <Label className="text-base font-medium">{control.title}</Label>
                  <Select
                    value={controlSelections[control.id]}
                    onValueChange={(value: string) => onControlChange(control.id, value)}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {control.options.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))
            ) : (
              <Alert>
                <Sparkles className="h-4 w-4" />
                <AlertTitle>当前无动态检查项</AlertTitle>
                <AlertDescription>{emptyStateMessage}</AlertDescription>
              </Alert>
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
