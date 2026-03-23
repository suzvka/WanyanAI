'use client';

import { ArrowLeft, Download } from 'lucide-react';
import { AnalysisReport } from '@/types/report';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { formatNumber, getGradeColor, getScoreColor } from './reportUtils';

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
          <CardTitle>快速概览</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-center p-4 bg-slate-50 rounded-lg">
              <div className="text-3xl font-bold mb-1" style={{ color: getScoreColor(report.dashboard.totalScore) }}>
                {formatNumber(report.dashboard.totalScore)}
              </div>
              <div className="text-sm text-slate-500">总分</div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">等级</span>
                <Badge className={getGradeColor(report.dashboard.grade)}>{report.dashboard.grade}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">发布准备度</span>
                <span className="text-sm font-medium">{report.dashboard.publishReadiness}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">问题数量</span>
                <span className="text-sm font-medium">{report.keyIssues.length}个</span>
              </div>
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
