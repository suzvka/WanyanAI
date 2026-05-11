'use client';

import { ArrowRight, Download, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { reportRatingDisplayLabels } from '@/config/reportScoring';
import type { GaokaoEssayData, GaokaoSubscore, GaokaoSection, GaokaoSectionGroup } from '../types';
import { formatNumber, getScoreColor, getGradeColor } from './utils';
import { GradeProgressBar } from './GradeProgressBar';

interface GaokaoEssayViewProps {
  report: GaokaoEssayData;
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

function ReportInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-[color:var(--report-text-subtle)]">{label}</span>
      <span className="text-right text-[color:var(--report-text-heading)]">{value}</span>
    </div>
  );
}

function SubscoreCard({ subscore }: { subscore: GaokaoSubscore }) {
  return (
    <div className="space-y-3">
      {/* 标题与评级 */}
      <div className="flex items-center justify-between gap-3">
        <h4 className="font-medium text-[color:var(--report-text-heading)]">
          {subscore.label}
        </h4>
        <Badge className={cn('text-sm font-semibold px-3 py-1', getGradeColor(subscore.grade))}>
          {subscore.grade}
        </Badge>
      </div>
      
      {/* 进度条量表 */}
      <GradeProgressBar grade={subscore.grade} score={subscore.score} maxScore={subscore.maxScore} />
      
      {/* 分数显示 */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">得分</span>
        <span className="font-medium text-[color:var(--report-text-heading)]">
          {formatNumber(subscore.score)} / {formatNumber(subscore.maxScore)}
        </span>
      </div>
      
      {/* 补充说明 */}
      <p className="text-sm leading-6 text-muted-foreground">
        {subscore.rationale}
      </p>
    </div>
  );
}

export function GaokaoEssayView({ report, onStartNew, onBackToEdit }: GaokaoEssayViewProps) {
  const sections = report.sections ?? [];
  const groups = report.groups ?? [];
  const subscores = report.dashboard.subscores ?? [];

  const handleDownload = () => {
    const dataStr = JSON.stringify(report, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `gaokao-essay-report-${report.reportId}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[color:var(--report-text-heading)]">
          {report.summary.title}
        </h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          {/* 总评区域 */}
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
                
                {/* 右侧：评分展示 */}
                <div className="p-6 bg-muted/20 border-l border-border/50">
                  <div className="space-y-6">
                    {/* 大号评分展示 */}
                    <div className="text-center">
                      <div 
                        className="text-6xl font-bold tracking-tight"
                        style={{ color: getScoreColor(report.dashboard.grade) }}
                      >
                        {formatNumber(report.dashboard.totalScore)}
                      </div>
                      <div className="mt-2 text-sm text-muted-foreground">
                        满分 {report.dashboard.maxScore} 分
                      </div>
                      <div className="mt-3 flex items-center justify-center gap-2">
                        <Badge 
                          className={cn(
                            'text-lg font-bold px-4 py-1.5',
                            getGradeColor(report.dashboard.grade)
                          )}
                        >
                          {report.dashboard.grade}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {reportRatingDisplayLabels[report.dashboard.grade]}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 子维度评级区 */}
          {subscores.length > 0 && (
            <Card>
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold text-[color:var(--report-text-heading)] mb-5">
                  维度评分
                </h2>
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

          {/* 分组内容 */}
          {groups.length > 0 ? (
            <div className="space-y-6">
              {groups.map((group: GaokaoSectionGroup) => (
                <Card key={group.id}>
                  <CardContent className="pb-6 px-6">
                    <h2 className="text-xl font-semibold text-[color:var(--report-text-heading)] mb-5">
                      {group.title}
                    </h2>
                    <div className="space-y-6">
                      {group.sections.map((section, sectionIndex) => {
                        const paragraphs = splitParagraphs(section.body);

                        return (
                          <div key={section.id}>
                            {sectionIndex > 0 && (
                              <div className="border-t border-[color:var(--report-border)] mb-5" />
                            )}
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-[color:var(--report-accent-dot)]" />
                                <h3 className="text-base font-semibold text-[color:var(--report-text-heading)]">{section.title}</h3>
                              </div>
                              {paragraphs.length > 0 ? (
                                paragraphs.map((paragraph, paragraphIndex) => (
                                  <p key={`${section.id}-${paragraphIndex}`} className="text-sm leading-7 text-[color:var(--report-text-subtle)]">
                                    {paragraph}
                                  </p>
                                ))
                              ) : (
                                <p className="whitespace-pre-line text-sm leading-7 text-[color:var(--report-text-subtle)]">{section.body}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : sections.length === 0 ? (
            <div className="rounded-lg border border-[color:var(--report-border)] bg-background p-6 text-sm text-[color:var(--report-text-subtle)]">
              暂无可展示的报告正文。
            </div>
          ) : (
            <div className="space-y-6">
              {sections.map((section: GaokaoSection) => {
                const paragraphs = splitParagraphs(section.body);

                return (
                  <Card key={section.id}>
                    <CardContent className="pt-5 pb-6 px-6">
                      <h2 className="text-xl font-semibold text-[color:var(--report-text-heading)] mb-5">
                        {section.title}
                      </h2>
                      <div className="space-y-4">
                        {paragraphs.length > 0 ? (
                          paragraphs.map((paragraph, paragraphIndex) => (
                            <p key={`${section.id}-${paragraphIndex}`} className="text-sm leading-7 text-[color:var(--report-text-subtle)]">
                              {paragraph}
                            </p>
                          ))
                        ) : (
                          <p className="whitespace-pre-line text-sm leading-7 text-[color:var(--report-text-subtle)]">{section.body}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* 侧边栏 */}
        <div className="space-y-6">
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
        </div>
      </div>
    </main>
  );
}
