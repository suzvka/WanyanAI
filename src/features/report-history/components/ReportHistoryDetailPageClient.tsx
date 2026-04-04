'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, FileWarning, List, SquarePen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ReportErrorBoundary } from '@/components/evaluate/ReportErrorBoundary';
import { getOutputMode } from '@/features/output-modes';
import { reportHistoryStore } from '@/features/report-history/store';
import type { CachedReportRecord } from '@/features/report-history/types';
import type { ModuleConfig } from '@/types/module';
import type { PlatformConfig } from '@/types/platform';
import HistoryAppShell from './HistoryAppShell';

interface ReportHistoryDetailPageClientProps {
  platformConfig: PlatformConfig;
  modules: ModuleConfig[];
  reportId: string;
}

export default function ReportHistoryDetailPageClient({
  platformConfig,
  modules,
  reportId,
}: ReportHistoryDetailPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [record, setRecord] = useState<CachedReportRecord | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // 页面过渡状态
  const [isPageVisible, setIsPageVisible] = useState(false);

  // 路由变化时触发页面过渡动画
  useEffect(() => {
    // 使用 setTimeout 延迟状态更新
    const hideTimer = setTimeout(() => setIsPageVisible(false), 0);
    const showTimer = setTimeout(() => setIsPageVisible(true), 50);
    return () => {
      clearTimeout(hideTimer);
      clearTimeout(showTimer);
    };
  }, [pathname]);

  const refreshRecord = useCallback(() => {
    setRecord(reportHistoryStore.getRecord(reportId));
    setIsLoaded(true);
  }, [reportId]);

  useEffect(() => {
    refreshRecord();

    return reportHistoryStore.subscribe(() => {
      refreshRecord();
    });
  }, [refreshRecord]);

  const moduleRoute = useMemo(() => {
    if (!record) {
      return '/';
    }

    return modules.find((module) => module.manifest.id === record.moduleId)?.manifest.route ?? '/';
  }, [modules, record]);

  const outputMode = useMemo(() => {
    if (!record) {
      return null;
    }

    if (record.status !== 'completed' || !record.report) {
      return null;
    }

    return getOutputMode(record.outputMode) ?? null;
  }, [record]);

  const canRender = Boolean(record && record.report && outputMode && outputMode.validate(record.report));
  const OutputRenderer = outputMode?.Renderer;

  return (
    <HistoryAppShell platformConfig={platformConfig} modules={modules}>
      <main 
        className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8"
        style={{
          opacity: isPageVisible ? 1 : 0,
          transform: isPageVisible ? 'translateY(0)' : 'translateY(16px)',
          transition: `opacity var(--motion-duration-slow) var(--motion-ease-emphasized),
                       transform var(--motion-duration-slow) var(--motion-ease-emphasized)`,
        }}
      >
        <div 
          className="mb-6 flex flex-wrap items-center gap-3"
          style={{
            opacity: isPageVisible ? 1 : 0,
            transform: isPageVisible ? 'translateY(0)' : 'translateY(8px)',
            transition: `opacity var(--motion-duration-standard) var(--motion-ease-emphasized) 60ms,
                         transform var(--motion-duration-standard) var(--motion-ease-emphasized) 60ms`,
          }}
        >
          <Button asChild variant="outline">
            <Link href="/history">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回历史列表
            </Link>
          </Button>
          <Button asChild>
            <Link href={moduleRoute}>
              <SquarePen className="mr-2 h-4 w-4" />
              前往原模块
            </Link>
          </Button>
        </div>

        {!isLoaded ? (
          <Card style={{
            opacity: isPageVisible ? 1 : 0,
            transform: isPageVisible ? 'translateY(0)' : 'translateY(12px)',
            transition: `opacity var(--motion-duration-standard) var(--motion-ease-emphasized) 120ms,
                         transform var(--motion-duration-standard) var(--motion-ease-emphasized) 120ms`,
          }}>
            <CardContent className="flex min-h-52 items-center justify-center text-sm text-muted-foreground">
              正在读取报告快照...
            </CardContent>
          </Card>
        ) : !record ? (
          <Card style={{
            opacity: isPageVisible ? 1 : 0,
            transform: isPageVisible ? 'translateY(0)' : 'translateY(12px)',
            transition: `opacity var(--motion-duration-standard) var(--motion-ease-emphasized) 120ms,
                         transform var(--motion-duration-standard) var(--motion-ease-emphasized) 120ms`,
          }}>
            <CardHeader>
              <CardTitle>未找到历史报告</CardTitle>
              <CardDescription>该报告可能已被清理，或当前浏览器尚未保存这条本地记录。</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/history">
                  <List className="mr-2 h-4 w-4" />
                  返回历史列表
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : record.status !== 'completed' || !record.report ? (
          <Card style={{
            opacity: isPageVisible ? 1 : 0,
            transform: isPageVisible ? 'translateY(0)' : 'translateY(12px)',
            transition: `opacity var(--motion-duration-standard) var(--motion-ease-emphasized) 120ms,
                         transform var(--motion-duration-standard) var(--motion-ease-emphasized) 120ms`,
          }}>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>{record.title}</CardTitle>
                <Badge variant={record.status === 'failed' ? 'destructive' : 'secondary'}>
                  {record.status === 'queued' ? '排队中' : record.status === 'running' ? '进行中' : '失败'}
                </Badge>
              </div>
              <CardDescription>
                {record.status === 'failed'
                  ? '该任务未成功生成最终报告。'
                  : '该任务仍在执行或等待执行，当前页展示任务快照。'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[color:var(--report-text-heading)]">
                    {record.progressSnapshot.currentEventLabel || record.progressSnapshot.currentLabel || '等待执行'}
                  </span>
                  <span className="text-muted-foreground">{record.progressSnapshot.progress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--report-surface-strong)]">
                  <div
                    className={`h-full rounded-full transition-all ${
                      record.status === 'failed'
                        ? 'bg-[color:var(--report-danger)]'
                        : record.status === 'running' || record.status === 'queued'
                          ? 'bg-[color:var(--report-score-medium)]'
                          : 'bg-primary'
                    }`}
                    style={{ width: `${record.progressSnapshot.progress}%` }}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border bg-background p-4">
                  <p className="text-xs text-muted-foreground">当前阶段</p>
                  <p className="mt-1 text-sm font-medium">{record.taskMeta.phase}</p>
                </div>
                <div className="rounded-lg border bg-background p-4">
                  <p className="text-xs text-muted-foreground">模型</p>
                  <p className="mt-1 text-sm font-medium break-all">{record.taskMeta.model}</p>
                </div>
                <div className="rounded-lg border bg-background p-4 sm:col-span-2">
                  <p className="text-xs text-muted-foreground">任务消息</p>
                  <p className={record.status === 'failed' ? 'mt-1 text-sm text-destructive' : 'mt-1 text-sm text-muted-foreground'}>
                    {record.taskMeta.errorMessage || record.taskMeta.message || '暂无更多信息'}
                  </p>
                </div>
                <div className="rounded-lg border bg-background p-4 sm:col-span-2">
                  <p className="text-xs text-muted-foreground">Base URL</p>
                  <p className="mt-1 text-sm break-all text-muted-foreground">{record.taskMeta.baseUrl}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : !outputMode || !OutputRenderer || !canRender ? (
          <Card style={{
            opacity: isPageVisible ? 1 : 0,
            transform: isPageVisible ? 'translateY(0)' : 'translateY(12px)',
            transition: `opacity var(--motion-duration-standard) var(--motion-ease-emphasized) 120ms,
                         transform var(--motion-duration-standard) var(--motion-ease-emphasized) 120ms`,
          }}>
            <CardHeader>
              <CardTitle>报告暂时无法渲染</CardTitle>
              <CardDescription>该历史记录的输出模式或数据结构与当前前端不兼容。</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild variant="outline">
                  <Link href="/history">
                    <List className="mr-2 h-4 w-4" />
                    返回历史列表
                  </Link>
                </Button>
                <Button asChild>
                  <Link href={moduleRoute}>
                    <FileWarning className="mr-2 h-4 w-4" />
                    前往原模块
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <ReportErrorBoundary
            onBackToEdit={() => router.push(moduleRoute)}
          >
            <OutputRenderer
              data={record.report}
              onStartNew={() => router.push(moduleRoute)}
              onBackToEdit={() => router.push(moduleRoute)}
            />
          </ReportErrorBoundary>
        )}
      </main>
    </HistoryAppShell>
  );
}
