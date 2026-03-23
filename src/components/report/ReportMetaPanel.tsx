'use client';

import { AnalysisReport } from '@/types/report';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface ReportMetaPanelProps {
  report: AnalysisReport;
}

export default function ReportMetaPanel({ report }: ReportMetaPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>分析摘要</CardTitle>
        <CardDescription>本次分析的总体概述</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="prose max-w-none">
            <h3 className="text-lg font-semibold mb-2">{report.summary.title}</h3>
            <p className="text-slate-700 leading-relaxed">{report.summary.overview}</p>
          </div>

          <Separator />

          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-500">报告ID：</span>
              <span className="font-mono">{report.reportId}</span>
            </div>
            <div>
              <span className="text-slate-500">生成时间：</span>
              <span>{new Date(report.generatedAt).toLocaleString('zh-CN')}</span>
            </div>
            <div>
              <span className="text-slate-500">框架版本：</span>
              <span>{report.meta.frameworkVersion}</span>
            </div>
            <div>
              <span className="text-slate-500">模型：</span>
              <span>{report.meta.model}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
