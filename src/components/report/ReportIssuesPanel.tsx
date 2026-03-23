'use client';

import { AnalysisReport } from '@/types/report';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getSeverityBadgeClass,
  getSeverityColor,
  getSeverityIcon,
  getSeverityText,
} from './reportUtils';

interface ReportIssuesPanelProps {
  issues: AnalysisReport['keyIssues'];
}

export default function ReportIssuesPanel({ issues }: ReportIssuesPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>核心问题</CardTitle>
        <CardDescription>需要优先解决的主要问题</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {issues.map((issue) => (
            <div key={issue.id} className={`p-4 rounded-lg border ${getSeverityColor(issue.severity)}`}>
              <div className="flex items-start gap-3">
                {getSeverityIcon(issue.severity)}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-semibold">{issue.title}</h4>
                    <Badge variant="outline" className={getSeverityBadgeClass(issue.severity)}>
                      {getSeverityText(issue.severity)}
                    </Badge>
                  </div>
                  <p className="text-slate-700 mb-3">{issue.description}</p>
                  <div className="bg-white/50 p-3 rounded">
                    <p className="text-sm font-medium text-slate-700">建议方向：</p>
                    <p className="text-sm text-slate-600">{issue.suggestionDirection}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
