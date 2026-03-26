'use client';

import { BarChart3, FileText, Target } from 'lucide-react';
import { AnalysisReport } from '@/types/report';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  formatNumber,
  getGradeColor,
  getRecommendationColor,
  getRecommendationIcon,
  getRecommendationText,
  getScoreColor,
} from './reportUtils';

interface ReportSummaryCardProps {
  report: AnalysisReport;
}

export default function ReportSummaryCard({ report }: ReportSummaryCardProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-slate-600" />
            报告总览
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <h2 className="text-xl font-semibold text-slate-900">{report.summary.title}</h2>
            <p className="text-sm leading-6 text-slate-600">{report.summary.overview}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-600" />
            评分概览
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-4 text-center">
              <div className="text-sm text-slate-500">总分</div>
              <div className="mt-2 text-5xl font-bold" style={{ color: getScoreColor(report.dashboard.totalScore) }}>
                {formatNumber(report.dashboard.totalScore)}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-4">
              <span className="text-sm text-slate-500">等级</span>
              <Badge className={getGradeColor(report.dashboard.grade)}>{report.dashboard.grade}</Badge>
            </div>

            <div className="rounded-lg border border-slate-200 p-4">
              <div className="text-sm text-slate-500">发布准备度</div>
              <div className="mt-2 text-base font-semibold text-slate-900">{report.dashboard.publishReadiness}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            最终建议
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`p-6 rounded-lg border-2 ${getRecommendationColor(report.conclusion.finalRecommendation)}`}>
            <div className="flex items-start gap-4">
              {getRecommendationIcon(report.conclusion.finalRecommendation)}
              <div className="flex-1 space-y-3">
                <Badge variant="secondary" className="w-fit bg-white/70 text-slate-700">
                  {getRecommendationText(report.conclusion.finalRecommendation)}
                </Badge>
                <h3 className="text-base font-semibold text-slate-900">结论摘要</h3>
                <p className="text-slate-700 leading-relaxed">{report.conclusion.rationale}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
