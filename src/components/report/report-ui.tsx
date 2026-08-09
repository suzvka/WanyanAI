/**
 * 报告页共享视觉原语
 *
 * 供各输出模式的报告渲染器复用，统一评分展示、章节卡片、侧栏等视觉语言。
 * 仅负责视觉层，不感知任何输出模式的数据契约。
 */

import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ReportRating } from '@/config/reportScoring';

/** 等级徽章 soft 底色类 */
export function getReportGradeBadgeClasses(grade: ReportRating): string {
  switch (grade) {
    case 'S':
      return 'text-[color:var(--report-grade-s)] bg-[color:var(--report-grade-s-soft)]';
    case 'A':
      return 'text-[color:var(--report-grade-a)] bg-[color:var(--report-grade-a-soft)]';
    case 'B':
      return 'text-[color:var(--report-grade-b)] bg-[color:var(--report-grade-b-soft)]';
    case 'C':
      return 'text-[color:var(--report-grade-c)] bg-[color:var(--report-grade-c-soft)]';
    case 'D':
      return 'text-[color:var(--report-grade-d)] bg-[color:var(--report-grade-d-soft)]';
    default:
      return 'text-[color:var(--report-neutral)] bg-[color:var(--report-neutral-soft)]';
  }
}

/** 总分数字：品牌渐变文字 */
export function ReportTotalScore({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'text-accent-gradient text-6xl font-bold tracking-tight tabular-nums',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** 等级胶囊徽章 */
export function ReportGradePill({
  grade,
  className,
}: {
  grade: ReportRating;
  className?: string;
}) {
  return (
    <Badge
      className={cn(
        'rounded-full px-4 py-1.5 text-lg font-bold',
        getReportGradeBadgeClasses(grade),
        className,
      )}
    >
      {grade}
    </Badge>
  );
}

/** 评分侧面板：柔和径向光晕底 */
export function ReportScorePanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden border-l border-border/50 bg-muted/20 p-6',
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full"
        style={{
          background:
            'radial-gradient(closest-side, var(--theme-primary), transparent)',
          opacity: 0.12,
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

/** 章节卡片：编号式标题 + 发丝线分隔 */
export function ReportSectionCard({
  index,
  title,
  children,
  className,
}: {
  index?: number;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardContent className="px-6 pb-6">
        <div className="mb-5 flex items-center gap-3 border-b border-border/60 pb-4">
          {typeof index === 'number' && (
            <span className="text-sm font-semibold tabular-nums text-muted-foreground/70">
              {String(index + 1).padStart(2, '0')}
            </span>
          )}
          <h2 className="text-xl font-semibold tracking-tight text-[color:var(--report-text-heading)]">
            {title}
          </h2>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

/** 段落标题前的品牌渐变圆点（4px） */
export function ReportParagraphDot() {
  return (
    <span
      aria-hidden="true"
      className="bg-accent-gradient h-1 w-1 shrink-0 rounded-full"
    />
  );
}

/** 报告元信息行 */
export function ReportInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-[color:var(--report-text-subtle)]">{label}</span>
      <span className="text-right text-[color:var(--report-text-heading)]">{value}</span>
    </div>
  );
}

/** 报告侧栏列：桌面端吸顶 */
export function ReportSideColumn({ children }: { children: ReactNode }) {
  return <div className="space-y-6 lg:sticky lg:top-20 lg:self-start">{children}</div>;
}
