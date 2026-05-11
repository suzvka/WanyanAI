import type { AnalysisTaskRecord } from '@/features/analysis-tasks/types';

export const REPORT_HISTORY_STORAGE_KEY = 'audience-ai-report-history';
export const MAX_REPORT_HISTORY_RECORDS = 100;

export type CachedReportRecord = AnalysisTaskRecord;

export type ReportHistoryStoreState = {
  recordsById: Record<string, CachedReportRecord>;
  order: string[];
};

export type ReportHistorySortBy = 'createdAt' | 'updatedAt' | 'title';
export type ReportHistorySortDirection = 'asc' | 'desc';

export type ReportHistoryQuery = {
  searchText?: string;
  moduleId?: string;
  outputMode?: string;
  sortBy?: ReportHistorySortBy;
  sortDirection?: ReportHistorySortDirection;
  limit?: number;
};
