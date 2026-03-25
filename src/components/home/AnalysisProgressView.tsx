'use client';

import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, RefreshCw, Wrench } from 'lucide-react';
import { AnalysisPhase, AnalysisStatus } from '@/types/appFlow';
import { Button } from '@/components/ui/button';

const phaseSteps: Array<{ key: AnalysisPhase; label: string; description: string }> = [
  { key: 'prepare-upload', label: '准备输入', description: '正在整理文本块、说明和附件元数据。' },
  { key: 'fetch-template', label: '获取模板', description: '正在按当前评价目标拉取提示词模板。' },
  { key: 'build-prompt', label: '构建提示词', description: '正在将输入内容和模板槽位拼接成最终请求。' },
  { key: 'request-model', label: '请求模型', description: '模型正在生成分析结果，请稍候。' },
  { key: 'extract-json', label: '提取 JSON', description: '正在从模型返回中提取结构化内容。' },
  { key: 'repair-json', label: '修复结构', description: '检测到格式异常时，系统会自动尝试修复一次。' },
  { key: 'normalize-report', label: '生成报告', description: '正在校验字段并生成最终展示报告。' },
];

interface AnalysisProgressViewProps {
  phase: AnalysisPhase;
  status: AnalysisStatus;
  message?: string;
  canRetry?: boolean;
  runningTitle?: string;
  runningDescription?: string;
  onRetry?: () => void;
  onBack?: () => void;
}

export default function AnalysisProgressView({
  phase,
  status,
  message,
  canRetry = false,
  runningTitle = '正在准备客户端分析请求...',
  runningDescription = '服务端仅返回提示词模板，最终提示词拼接与模型调用均在浏览器内完成。',
  onRetry,
  onBack,
}: AnalysisProgressViewProps) {
  const activeIndex = phaseSteps.findIndex((step) => step.key === phase);
  const currentStep = phaseSteps[activeIndex] || phaseSteps[0];

  const header =
    status === 'failed'
      ? {
          icon: <AlertCircle className="w-12 h-12 text-red-500" />,
          title: '分析已中断',
          description: '可以返回修改输入，或在当前参数下重新生成。',
        }
      : status === 'recovering'
        ? {
            icon: <Wrench className="w-12 h-12 text-amber-500" />,
            title: '正在修复分析结果...',
            description: '模型返回结构存在异常，系统正在自动恢复。',
          }
        : {
            icon: <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />,
            title: runningTitle,
            description: runningDescription,
          };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center">{header.icon}</div>
        <h2 className="text-2xl font-bold text-slate-900">{header.title}</h2>
        <p className="text-slate-600 max-w-md mx-auto">{message || header.description}</p>
      </div>

      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white/80 p-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-900">当前阶段：{currentStep.label}</p>
          <p className="text-sm text-slate-500">{currentStep.description}</p>
        </div>
      </div>

      <div className="w-full max-w-md space-y-4">
        {phaseSteps.map((step, index) => {
          if (index < activeIndex) {
            return (
              <div key={step.key} className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <span className="text-slate-700">{step.label}</span>
              </div>
            );
          }

          if (index === activeIndex) {
            return (
              <div key={step.key} className="flex items-start gap-3">
                {status === 'failed' ? (
                  <AlertCircle className="w-5 h-5 mt-0.5 text-red-500" />
                ) : status === 'recovering' ? (
                  <Wrench className="w-5 h-5 mt-0.5 text-amber-500" />
                ) : (
                  <Loader2 className="w-5 h-5 mt-0.5 text-blue-500 animate-spin" />
                )}
                <div className="space-y-1">
                  <span className="text-slate-700">{step.label}{status !== 'failed' ? '...' : ''}</span>
                  <p className="text-sm text-slate-500">{step.description}</p>
                </div>
              </div>
            );
          }

          return (
            <div key={step.key} className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 mt-0.5 text-slate-300" />
              <div className="space-y-1">
                <span className="text-slate-400">{step.label}</span>
                <p className="text-sm text-slate-400">{step.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      {status === 'failed' && (
        <div className="flex flex-col sm:flex-row gap-3">
          {canRetry && onRetry && (
            <Button onClick={onRetry} className="min-w-[140px]">
              <RefreshCw className="mr-2 h-4 w-4" />
              重新生成
            </Button>
          )}
          {onBack && (
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回修改输入
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
