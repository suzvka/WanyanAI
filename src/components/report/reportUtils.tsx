import { AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import type { ReportConclusion } from '@/types/report';

export function formatNumber(num: number): string {
  const value = Number(num);
  return Number.isInteger(value) ? value.toString() : value.toFixed(2);
}

export function getScoreColor(score: number): string {
  if (score >= 80) return '#059669';
  if (score >= 60) return '#d97706';
  return '#dc2626';
}

export function getGradeColor(grade: string): string {
  switch (grade) {
    case 'A':
      return 'text-green-600 bg-green-50';
    case 'B':
      return 'text-blue-600 bg-blue-50';
    case 'C':
      return 'text-yellow-600 bg-yellow-50';
    case 'D':
      return 'text-orange-600 bg-orange-50';
    case 'E':
      return 'text-red-600 bg-red-50';
    default:
      return 'text-slate-600 bg-slate-50';
  }
}

export function getRecommendationColor(recommendation: ReportConclusion['finalRecommendation']): string {
  switch (recommendation) {
    case 'publish':
      return 'border-green-200 bg-green-50';
    case 'revise_then_publish':
      return 'border-yellow-200 bg-yellow-50';
    case 'rework':
      return 'border-red-200 bg-red-50';
    default:
      return 'border-slate-200 bg-slate-50';
  }
}

export function getRecommendationText(recommendation: ReportConclusion['finalRecommendation']): string {
  switch (recommendation) {
    case 'publish':
      return '建议发布';
    case 'revise_then_publish':
      return '修改后发布';
    case 'rework':
      return '建议重构';
    default:
      return '待定';
  }
}

export function getRecommendationIcon(recommendation: ReportConclusion['finalRecommendation']) {
  switch (recommendation) {
    case 'publish':
      return <CheckCircle2 className="w-6 h-6 text-green-600" />;
    case 'revise_then_publish':
      return <AlertCircle className="w-6 h-6 text-yellow-600" />;
    case 'rework':
      return <XCircle className="w-6 h-6 text-red-600" />;
    default:
      return <AlertCircle className="w-6 h-6 text-slate-600" />;
  }
}
