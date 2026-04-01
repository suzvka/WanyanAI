'use client';

import { cn } from '@/lib/utils';
import type { ReportRating } from '@/config/reportScoring';

interface GradeProgressBarProps {
  grade: ReportRating;
  score: number;
  maxScore?: number;
  className?: string;
}

const gradeColors: Record<ReportRating, { bar: string }> = {
  S: { bar: 'bg-[color:var(--report-grade-s)]' },
  A: { bar: 'bg-[color:var(--report-grade-a)]' },
  B: { bar: 'bg-[color:var(--report-grade-b)]' },
  C: { bar: 'bg-[color:var(--report-grade-c)]' },
  D: { bar: 'bg-[color:var(--report-grade-d)]' },
};

export function GradeProgressBar({ 
  grade, 
  score, 
  maxScore = 10,
  className 
}: GradeProgressBarProps) {
  const percentage = Math.round((score / maxScore) * 100);
  const colors = gradeColors[grade];

  return (
    <div className={cn('', className)}>
      {/* 进度条 */}
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted/50">
        {/* 背景刻度线 */}
        <div className="absolute inset-0 flex">
          {[20, 40, 60, 80].map((pos) => (
            <div 
              key={pos} 
              className="h-full w-px bg-border/50"
              style={{ marginLeft: `${pos - 0.5}%` }}
            />
          ))}
        </div>
        {/* 进度填充 */}
        <div 
          className={cn(
            'h-full rounded-full transition-all duration-500 ease-out',
            colors.bar,
          )}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}
