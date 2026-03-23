'use client';

import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { AnalysisReport } from '@/types/report';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { formatNumber, getGradeColor, getScoreColor } from './reportUtils';

interface ReportDimensionsPanelProps {
  dimensions: AnalysisReport['dimensions'];
  variant: 'dashboard' | 'details';
}

export default function ReportDimensionsPanel({ dimensions, variant }: ReportDimensionsPanelProps) {
  if (variant === 'dashboard') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>分维度评分</CardTitle>
          <CardDescription>各维度的详细评分情况</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {dimensions.map((dimension) => (
              <div key={dimension.dimensionKey} className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{dimension.dimensionName}</span>
                    <Badge className={getGradeColor(dimension.grade)}>{dimension.grade}</Badge>
                  </div>
                  <span className="text-sm font-bold" style={{ color: getScoreColor(dimension.score) }}>
                    {formatNumber(dimension.score)}分
                  </span>
                </div>
                <Progress value={dimension.score} className="h-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>分维度详细分析</CardTitle>
        <CardDescription>各维度的优势和改进空间</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px] pr-4">
          <div className="space-y-6">
            {dimensions.map((dimension) => (
              <div key={dimension.dimensionKey} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{dimension.dimensionName}</h3>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold" style={{ color: getScoreColor(dimension.score) }}>
                      {formatNumber(dimension.score)}
                    </span>
                    <Badge className={getGradeColor(dimension.grade)}>{dimension.grade}</Badge>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      优势
                    </h4>
                    <ul className="space-y-2">
                      {dimension.strengths.map((strength, index) => (
                        <li key={index} className="text-sm text-green-700 flex items-start gap-2">
                          <span className="text-green-600 mt-1">•</span>
                          {strength}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-yellow-800 mb-2 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      改进空间
                    </h4>
                    <ul className="space-y-2">
                      {dimension.weaknesses.map((weakness, index) => (
                        <li key={index} className="text-sm text-yellow-700 flex items-start gap-2">
                          <span className="text-yellow-600 mt-1">•</span>
                          {weakness}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <Separator />
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
