'use client';

import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

export default function AnalysisProgressView() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">AI 正在分析您的文本...</h2>
        <p className="text-slate-600 max-w-md mx-auto">正在进行多维度文本质量评估，请稍候片刻</p>
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
  );
}
