'use client';

import { Target, Trophy } from 'lucide-react';
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
    <div className="grid md:grid-cols-3 gap-6">
      <Card className="md:col-span-1">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-600" />
            总体评分
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center space-y-4">
            <div className="relative">
              <div className="text-6xl font-bold" style={{ color: getScoreColor(report.dashboard.totalScore) }}>
                {formatNumber(report.dashboard.totalScore)}
              </div>
              <div className="text-sm text-slate-500">总分 100</div>
            </div>
            <Badge className={`text-lg px-4 py-1 ${getGradeColor(report.dashboard.grade)}`}>
              等级 {report.dashboard.grade}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
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
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-2">{getRecommendationText(report.conclusion.finalRecommendation)}</h3>
                <p className="text-slate-700 leading-relaxed">{report.conclusion.rationale}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
