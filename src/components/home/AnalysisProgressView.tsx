'use client';

import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { AnalysisPhase } from '@/types/appFlow';

const phaseSteps: Array<{ key: AnalysisPhase; label: string }> = [
  { key: 'fetch-template', label: '获取提示词模板' },
  { key: 'build-prompt', label: '拼接最终提示词' },
  { key: 'request-model', label: '请求模型分析' },
  { key: 'parse-report', label: '解析结构化报告' },
];

interface AnalysisProgressViewProps {
  phase: AnalysisPhase;
}

export default function AnalysisProgressView({ phase }: AnalysisProgressViewProps) {
  const activeIndex = phaseSteps.findIndex((step) => step.key === phase);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">正在准备客户端分析请求...</h2>
        <p className="text-slate-600 max-w-md mx-auto">服务端仅返回提示词模板，最终提示词拼接与模型调用均在浏览器内完成。</p>
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
              <div key={step.key} className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                <span className="text-slate-700">{step.label}...</span>
              </div>
            );
          }

          return (
            <div key={step.key} className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-slate-300" />
              <span className="text-slate-400">{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
