'use client';

import { ArrowLeft, Download } from 'lucide-react';
import { AnalysisReport } from '@/types/report';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ReportSidebarProps {
  report: AnalysisReport;
  onReset: () => void;
  onDownload: () => void;
}

export default function ReportSidebar({ report, onReset, onDownload }: ReportSidebarProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>报告信息</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-slate-600">
            <div className="flex items-start justify-between gap-3">
              <span className="shrink-0 text-slate-500">报告 ID</span>
              <span className="text-right font-mono text-xs text-slate-700">{report.reportId}</span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <span className="shrink-0 text-slate-500">生成时间</span>
              <span className="text-right text-slate-700">{new Date(report.generatedAt).toLocaleString('zh-CN')}</span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <span className="shrink-0 text-slate-500">模型</span>
              <span className="text-right text-slate-700">{report.meta.model}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>操作建议</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Button onClick={onReset} variant="outline" className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              分析新文本
            </Button>
            <Button onClick={onDownload} className="w-full">
              <Download className="w-4 h-4 mr-2" />
              下载报告
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
