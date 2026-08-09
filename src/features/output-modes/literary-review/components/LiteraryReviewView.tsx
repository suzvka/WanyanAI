'use client';

import { ArrowRight, Download, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { reportRatingDisplayLabels } from '@/config/reportScoring';
import {
  ReportGradePill,
  ReportInfoRow,
  ReportParagraphDot,
  ReportScorePanel,
  ReportSectionCard,
  ReportSideColumn,
  ReportTotalScore,
} from '@/components/report/report-ui';
import type { LiteraryReviewData, LiteraryReviewSubscore, LiteraryReviewSection } from '../types';
import { formatNumber, getGradeColor } from './utils';
import { SubscoreRadarChart } from './SubscoreRadarChart';
import { GradeProgressBar } from './GradeProgressBar';

interface LiteraryReviewViewProps {
  report: LiteraryReviewData;
  /** 开始新分析（清空所有数据，从新工作区开始） */
  onStartNew?: () => void;
  /** 返回编辑（保持当前数据，回到编辑页面） */
  onBackToEdit?: () => void;
}

function splitParagraphs(body: string) {
  return body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function SubscoreCard({ subscore }: { subscore: LiteraryReviewSubscore }) {
  return (
    <div className="space-y-3">
      {/* 标题与评级 - 紧密相邻 */}
      <div className="flex items-center justify-between gap-3">
        <h4 className="font-medium text-[color:var(--report-text-heading)]">
          {subscore.label}
        </h4>
        <Badge className={cn('text-sm font-semibold px-3 py-1', getGradeColor(subscore.grade))}>
          {subscore.grade}
        </Badge>
      </div>
      
      {/* 进度条量表 */}
      <GradeProgressBar grade={subscore.grade} score={subscore.score} />
      
      {/* 补充说明 - 使用较弱的视觉层级 */}
      <p className="text-sm leading-6 text-muted-foreground">
        {subscore.rationale}
      </p>
    </div>
  );
}

export function LiteraryReviewView({ report, onStartNew, onBackToEdit }: LiteraryReviewViewProps) {
  const sections = report.sections ?? [];
  const subscores = report.dashboard.subscores ?? [];

  const handleDownload = () => {
    const dataStr = JSON.stringify(report, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `report-${report.reportId}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* 页面标题 - 直接使用报告标题 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[color:var(--report-text-heading)]">
          {report.summary.title}
        </h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          {/* 总评区域 - 视觉强化 */}
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="grid md:grid-cols-2">
                {/* 左侧：概述 */}
                <div className="pb-6 px-6">
                  <h2 className="text-xl font-semibold text-[color:var(--report-text-heading)] mb-5">
                    概述
                  </h2>
                  <p className="text-sm leading-7 text-[color:var(--report-text-subtle)]">
                    {report.summary.overview}
                  </p>
                </div>
                
                {/* 右侧：评分展示 + 雷达图 */}
                <ReportScorePanel>
                  <div className="space-y-6">
                    {/* 大号评分展示 */}
                    <div className="text-center">
                      <ReportTotalScore>
                        {formatNumber(report.dashboard.totalScore)}
                      </ReportTotalScore>
                      <div className="mt-3 flex items-center justify-center gap-2">
                        <ReportGradePill grade={report.dashboard.grade} />
                        <span className="text-sm text-muted-foreground">
                          {reportRatingDisplayLabels[report.dashboard.grade]}
                        </span>
                      </div>
                    </div>
                    
                    {/* 雷达图 */}
                    {subscores.length > 0 && (
                      <SubscoreRadarChart subscores={subscores} />
                    )}
                  </div>
                </ReportScorePanel>
              </div>
            </CardContent>
          </Card>

          {/* 子维度评级区 */}
          {subscores.length > 0 && (
            <Card>
              <CardContent className="p-6">
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {subscores.map((subscore) => (
                    <SubscoreCard key={subscore.id} subscore={subscore} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 整体评价 */}
          <Card>
            <CardContent className="pb-6 px-6">
              <h2 className="text-xl font-semibold text-[color:var(--report-text-heading)] mb-5">
                整体评价
              </h2>
              <p className="leading-7 text-[color:var(--report-text-subtle)]">
                {report.conclusion.rationale}
              </p>
            </CardContent>
          </Card>

          {/* 章节内容（按 sectionTitle 分组） */}
          {sections.length === 0 ? (
            <div className="rounded-2xl border border-[color:var(--report-border)] bg-background p-6 text-sm text-[color:var(--report-text-subtle)]">
              暂无可展示的报告正文。
            </div>
          ) : (
            <div className="space-y-6">
              {Array.from(new Map(
                sections.map((s) => [s.sectionTitle, null])
              ).keys()).map((sectionTitle, sectionIndex) => {
                const sectionParagraphs = sections.filter((s) => s.sectionTitle === sectionTitle);

                return (
                  <ReportSectionCard key={sectionTitle} index={sectionIndex} title={sectionTitle}>
                    <div className="space-y-6">
                      {sectionParagraphs.map((paragraph, index) => (
                        <div key={`${paragraph.paragraphTitle}-${index}`}>
                          {index > 0 && (
                            <div className="border-t border-[color:var(--report-border)]/60 mb-5" />
                          )}
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <ReportParagraphDot />
                              <h3 className="text-base font-semibold text-[color:var(--report-text-heading)]">
                                {paragraph.paragraphTitle}
                              </h3>
                            </div>
                            <p className="text-sm leading-7 text-[color:var(--report-text-subtle)]">
                              {paragraph.body}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ReportSectionCard>
                );
              })}
            </div>
          )}
        </div>

        {/* 侧边栏 */}
        <ReportSideColumn>
          <Card>
            <CardContent className="p-4">
              <div className="space-y-3 text-sm text-[color:var(--report-text-subtle)]">
                <ReportInfoRow label="报告 ID" value={report.reportId} />
                <ReportInfoRow label="生成时间" value={new Date(report.generatedAt).toLocaleString('zh-CN')} />
                <ReportInfoRow label="模型" value={report.meta.model} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="space-y-3">
                <Button
                  onClick={onStartNew}
                  className="w-full"
                >
                  <ArrowRight className="mr-2 h-4 w-4" />
                  再来一篇
                </Button>
                <Button
                  onClick={onBackToEdit}
                  variant="outline"
                  className="w-full"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  返回编辑
                </Button>
                <Button onClick={handleDownload} variant="secondary" className="w-full">
                  <Download className="mr-2 h-4 w-4" />
                  下载报告
                </Button>
              </div>
            </CardContent>
          </Card>
        </ReportSideColumn>
      </div>
    </main>
  );
}
