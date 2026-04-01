/**
 * report-json 输出模式工具函数
 */

import type { ReportRating } from '@/config/reportScoring';

export function formatNumber(num: number): string {
  const value = Number(num);
  return Number.isInteger(value) ? value.toString() : value.toFixed(2);
}

export function getScoreColor(grade: ReportRating): string {
  switch (grade) {
    case 'S':
      return 'var(--report-grade-s)';
    case 'A':
      return 'var(--report-grade-a)';
    case 'B':
      return 'var(--report-grade-b)';
    case 'C':
      return 'var(--report-grade-c)';
    case 'D':
    default:
      return 'var(--report-grade-d)';
  }
}

export function getGradeColor(grade: ReportRating): string {
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
