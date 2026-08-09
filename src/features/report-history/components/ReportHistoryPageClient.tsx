'use client';

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ChangeEvent } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, Clock3, FileClock, MoreHorizontal, PencilLine, Search, SlidersHorizontal, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { getOutputModeRenderer } from '@/features/output-modes';
import { reportHistoryStore } from '@/features/report-history/store';
import type { CachedReportRecord, ReportHistoryQuery } from '@/features/report-history/types';
import type { PageModulePublicMeta } from '@/types/module';
import type { PlatformConfig } from '@/types/platform';
import HistoryAppShell from './HistoryAppShell';

// 输出模式名称映射
const OUTPUT_MODE_NAMES: Record<string, string> = {
  'literary-review': '文学作品',
  'gaokao-essay': '高考作文',
};

const statusBadgeVariant: Record<CachedReportRecord['status'], 'secondary' | 'outline' | 'destructive'> = {
  queued: 'secondary',
  running: 'outline',
  completed: 'secondary',
  failed: 'destructive',
};

const statusLabel: Record<CachedReportRecord['status'], string> = {
  queued: '排队中',
  running: '进行中',
  completed: '已完成',
  failed: '失败',
};

const actionLabel: Record<CachedReportRecord['status'], string> = {
  queued: '查看进度',
  running: '查看进度',
  completed: '查看报告',
  failed: '查看详情',
};

interface ReportHistoryPageClientProps {
  platformConfig: PlatformConfig;
  modules: PageModulePublicMeta[];
}

const defaultHistoryQuery: ReportHistoryQuery = {
  sortBy: 'createdAt',
  sortDirection: 'desc',
};

// 服务端快照必须返回稳定引用：每次调用返回新数组会导致 hydration 无限循环
const EMPTY_REPORTS: CachedReportRecord[] = [];
const getServerReports = () => EMPTY_REPORTS;

export default function ReportHistoryPageClient({
  platformConfig,
  modules,
}: ReportHistoryPageClientProps) {
  const pathname = usePathname();
  // 订阅 reportHistoryStore：初始同步读取缓存快照，store 变更（含其他标签页）后自动更新
  const records = useSyncExternalStore(
    reportHistoryStore.subscribe,
    useCallback(() => reportHistoryStore.listReports(defaultHistoryQuery), []),
    getServerReports,
  );
  const [recordPendingDelete, setRecordPendingDelete] = useState<CachedReportRecord | null>(null);
  const [recordPendingRename, setRecordPendingRename] = useState<CachedReportRecord | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);

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

  const renameDialogOpen = Boolean(recordPendingRename);
  const deleteDialogOpen = Boolean(recordPendingDelete);
  const trimmedDraftTitle = useMemo(() => draftTitle.trim(), [draftTitle]);

  const handleRenameStart = useCallback((record: CachedReportRecord) => {
    setRecordPendingRename(record);
    setDraftTitle(record.title);
    setRenameError(null);
  }, []);

  const handleRenameClose = useCallback((open: boolean) => {
    if (open) {
      return;
    }

    setRecordPendingRename(null);
    setDraftTitle('');
    setRenameError(null);
  }, []);

  const handleRenameSubmit = useCallback(() => {
    if (!recordPendingRename) {
      return;
    }

    if (!trimmedDraftTitle) {
      setRenameError('报告标题不能为空');
      return;
    }

    try {
      reportHistoryStore.renameReport(recordPendingRename.id, trimmedDraftTitle);
      handleRenameClose(false);
    } catch (error) {
      setRenameError(error instanceof Error ? error.message : '重命名失败');
    }
  }, [handleRenameClose, recordPendingRename, trimmedDraftTitle]);

  const handleDeleteConfirm = useCallback(() => {
    if (!recordPendingDelete) {
      return;
    }

    reportHistoryStore.removeReport(recordPendingDelete.id);
    setRecordPendingDelete(null);
  }, [recordPendingDelete]);

  return (
    <HistoryAppShell platformConfig={platformConfig} modules={modules}>
      <main 
        className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8"
        style={{
          opacity: isPageVisible ? 1 : 0,
          transform: isPageVisible ? 'translateY(0)' : 'translateY(16px)',
          transition: `opacity var(--motion-duration-slow) var(--motion-ease-emphasized),
                       transform var(--motion-duration-slow) var(--motion-ease-emphasized)`,
        }}
      >
        <div className="space-y-6">
          <Card style={{
            opacity: isPageVisible ? 1 : 0,
            transform: isPageVisible ? 'translateY(0)' : 'translateY(12px)',
            transition: `opacity var(--motion-duration-standard) var(--motion-ease-emphasized) 60ms,
                         transform var(--motion-duration-standard) var(--motion-ease-emphasized) 60ms`,
          }}>
            <CardHeader className="space-y-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <CardTitle className="text-2xl">历史报告</CardTitle>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary" className="gap-1">
                    <Clock3 className="h-3.5 w-3.5" />
                    时间倒序
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <Search className="h-3.5 w-3.5" />
                    搜索预留
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    筛选排序预留
                  </Badge>
                </div>
              </div>
            </CardHeader>
          </Card>

          {records.length === 0 ? (
            <Card style={{
              opacity: isPageVisible ? 1 : 0,
              transform: isPageVisible ? 'translateY(0)' : 'translateY(12px)',
              transition: `opacity var(--motion-duration-standard) var(--motion-ease-emphasized) 120ms,
                           transform var(--motion-duration-standard) var(--motion-ease-emphasized) 120ms`,
            }}>
              <CardContent className="flex min-h-52 flex-col items-center justify-center gap-4 text-center">
                <div className="rounded-full bg-muted p-3">
                  <FileClock className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <p className="text-lg font-medium text-[color:var(--report-text-heading)]">还没有历史报告</p>
                  <p className="text-sm text-muted-foreground">完成一次分析后，任务进度和最终报告会自动缓存在本地并显示在这里。</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {records.map((record: CachedReportRecord, index: number) => {
                const outputModeName = OUTPUT_MODE_NAMES[record.outputMode] ?? record.outputMode;
                const moduleName = modules.find((module) => module.slug === record.moduleId)?.title ?? record.moduleId;
                const progress = record.progressSnapshot.progress;
                const helperText =
                  record.status === 'failed'
                    ? record.taskMeta.errorMessage || '任务执行失败'
                    : record.taskMeta.message || record.progressSnapshot.currentEventLabel || record.progressSnapshot.currentLabel;

                return (
                  <Card 
                    key={record.id}
                    style={{
                      opacity: isPageVisible ? 1 : 0,
                      transform: isPageVisible ? 'translateY(0)' : 'translateY(12px)',
                      transition: `opacity var(--motion-duration-standard) var(--motion-ease-emphasized) ${120 + index * 50}ms,
                                   transform var(--motion-duration-standard) var(--motion-ease-emphasized) ${120 + index * 50}ms`,
                    }}
                  >
                    <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-3 flex-1">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-lg font-semibold text-[color:var(--report-text-heading)]">{record.title}</h2>
                            <Badge variant={statusBadgeVariant[record.status]}>{statusLabel[record.status]}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">ID: {record.id}</p>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <Badge variant="secondary">{outputModeName}</Badge>
                          <Badge variant="outline">{moduleName}</Badge>
                          <Badge variant="outline">{record.taskMeta.model}</Badge>
                          <Badge variant="outline">{new Date(record.createdAt).toLocaleString('zh-CN')}</Badge>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-[color:var(--report-text-heading)]">
                              {record.progressSnapshot.currentEventLabel || record.progressSnapshot.currentLabel || statusLabel[record.status]}
                            </span>
                            <span className="text-muted-foreground">{progress}%</span>
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
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          {helperText && (
                            <p className={record.status === 'failed' ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>
                              {helperText}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 md:shrink-0">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button type="button" variant="outline" size="icon" className="size-10">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">更多操作</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem onClick={() => handleRenameStart(record)}>
                              <PencilLine className="mr-2 h-4 w-4" />
                              重命名
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setRecordPendingDelete(record)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              删除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button asChild>
                          <Link href={`/history/${record.id}`}>
                            {actionLabel[record.status]}
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <Dialog open={renameDialogOpen} onOpenChange={handleRenameClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重命名历史报告</DialogTitle>
            <DialogDescription>
              标题允许重复，系统仍会使用报告 ID 作为唯一索引。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              value={draftTitle}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                setDraftTitle(event.target.value);
                if (renameError) {
                  setRenameError(null);
                }
              }}
              placeholder="请输入报告标题"
              maxLength={120}
              autoFocus
            />
            {renameError && <p className="text-sm text-destructive">{renameError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleRenameClose(false)}>
              取消
            </Button>
            <Button onClick={handleRenameSubmit}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={(open: boolean) => !open && setRecordPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除这条历史报告？</AlertDialogTitle>
            <AlertDialogDescription>
              {recordPendingDelete
                ? `删除后将无法在当前浏览器中恢复「${recordPendingDelete.title}」。`
                : '删除后将无法在当前浏览器中恢复该历史报告。'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </HistoryAppShell>
  );
}
