import { validatePersistedAnalysisReport, validateReportHistoryStoreState } from '@/lib/validation/reportHistory';
import type { PersistedAnalysisReport } from '@/types/analysis';
import { createLogger } from '@/lib/api-station/logger';
import {
  MAX_REPORT_HISTORY_RECORDS,
  REPORT_HISTORY_STORAGE_KEY,
  type CachedReportRecord,
  type ReportHistoryQuery,
  type ReportHistoryStoreState,
} from './types';

const logger = createLogger('report-history');

const REPORT_HISTORY_UPDATED_EVENT = 'report-history-updated';

const emptyState: ReportHistoryStoreState = {
  recordsById: {},
  order: [],
};

function persistState(state: ReportHistoryStoreState) {
  logger.debug('persistState called', {
    recordCount: Object.keys(state.recordsById).length,
    orderLength: state.order.length,
  });
  localStorage.setItem(REPORT_HISTORY_STORAGE_KEY, JSON.stringify(state));

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(REPORT_HISTORY_UPDATED_EVENT));
  }
}

function normalizeState(state: ReportHistoryStoreState): ReportHistoryStoreState {
  const order = state.order.filter((id) => state.recordsById[id] !== undefined);
  const recordsById = Object.fromEntries(order.map((id) => [id, state.recordsById[id]]));

  return {
    recordsById,
    order,
  };
}

function getReportTitle(report: PersistedAnalysisReport): string {
  if (report.rawJson && typeof report.rawJson === 'object') {
    const rawJson = report.rawJson as { summary?: { title?: unknown } };
    if (typeof rawJson.summary?.title === 'string' && rawJson.summary.title.trim()) {
      return rawJson.summary.title.trim();
    }
  }

  return `${report.metadata.moduleId || report.metadata.outputMode}概览`;
}

function buildCachedRecord(report: PersistedAnalysisReport): CachedReportRecord {
  const title = getReportTitle(report);

  return {
    id: report.reportId,
    title,
    createdAt: report.createdAt,
    updatedAt: new Date().toISOString(),
    moduleId: report.moduleId,
    outputMode: report.outputMode,
    status: 'completed',
    progressSnapshot: {
      progress: 100,
      currentStage: 'normalize',
      currentLabel: '生成报告',
      currentEventLabel: '提交报告',
      status: 'completed',
    },
    taskMeta: {
      phase: 'normalize',
      message: '报告已生成',
      model: report.metadata.model,
      baseUrl: report.metadata.baseUrl,
      schedulerKey: 'completed-report',
    },
    report,
  };
}

type CreateTaskRecordInput = {
  id: string;
  title: string;
  createdAt: string;
  moduleId: string;
  outputMode: string;
  model: string;
  baseUrl: string;
  schedulerKey: string;
};

type UpdateTaskRecordInput = {
  title?: string;
  status?: CachedReportRecord['status'];
  progressSnapshot?: CachedReportRecord['progressSnapshot'];
  taskMeta?: Partial<CachedReportRecord['taskMeta']>;
  report?: PersistedAnalysisReport;
};

function trimState(state: ReportHistoryStoreState): ReportHistoryStoreState {
  if (state.order.length <= MAX_REPORT_HISTORY_RECORDS) {
    return state;
  }

  const retainedOrder = state.order.slice(0, MAX_REPORT_HISTORY_RECORDS);
  const retainedIds = new Set(retainedOrder);
  const recordsById = Object.fromEntries(
    Object.entries(state.recordsById).filter(([id]) => retainedIds.has(id)),
  );

  return {
    recordsById,
    order: retainedOrder,
  };
}

function sortRecords(records: CachedReportRecord[], query: ReportHistoryQuery): CachedReportRecord[] {
  const sortBy = query.sortBy ?? 'createdAt';
  const direction = query.sortDirection ?? 'desc';
  const factor = direction === 'asc' ? 1 : -1;

  return [...records].sort((left, right) => {
    if (sortBy === 'title') {
      return left.title.localeCompare(right.title, 'zh-CN') * factor;
    }

    const leftValue = sortBy === 'updatedAt' ? left.updatedAt : left.createdAt;
    const rightValue = sortBy === 'updatedAt' ? right.updatedAt : right.createdAt;

    return (new Date(leftValue).getTime() - new Date(rightValue).getTime()) * factor;
  });
}

export const reportHistoryStore = {
  changeEventName: REPORT_HISTORY_UPDATED_EVENT,

  getState(): ReportHistoryStoreState {
    if (typeof window === 'undefined') {
      return emptyState;
    }

    try {
      const stored = localStorage.getItem(REPORT_HISTORY_STORAGE_KEY);
      if (!stored) {
        logger.debug('getState: No stored data found');
        return emptyState;
      }

      logger.debug('getState: Parsing stored data');
      const parsed = validateReportHistoryStoreState(JSON.parse(stored));
      if (!parsed.success) {
        logger.error('getState: Validation failed, removing storage', undefined, { error: parsed.error });
        localStorage.removeItem(REPORT_HISTORY_STORAGE_KEY);
        return emptyState;
      }

      const normalized = normalizeState(parsed.data);
      logger.debug('getState: Returning state', {
        recordCount: Object.keys(normalized.recordsById).length,
        orderLength: normalized.order.length,
      });
      return normalized;
    } catch (error) {
      logger.error('getState: Error', error);
      return emptyState;
    }
  },

  saveState(state: ReportHistoryStoreState): void {
    if (typeof window === 'undefined') {
      return;
    }

    const parsed = validateReportHistoryStoreState(state);
    if (!parsed.success) {
      throw new Error(parsed.error);
    }

    persistState(trimState(normalizeState(parsed.data)));
  },

  subscribe(listener: () => void): () => void {
    if (typeof window === 'undefined') {
      return () => undefined;
    }

    const handleChange = () => listener();
    window.addEventListener('storage', handleChange);
    window.addEventListener(REPORT_HISTORY_UPDATED_EVENT, handleChange);

    return () => {
      window.removeEventListener('storage', handleChange);
      window.removeEventListener(REPORT_HISTORY_UPDATED_EVENT, handleChange);
    };
  },

  createTaskRecord(input: CreateTaskRecordInput): CachedReportRecord {
    if (typeof window === 'undefined') {
      throw new Error('历史任务仅支持在浏览器环境中创建');
    }

    logger.debug('createTaskRecord called', {
      id: input.id,
      title: input.title,
      moduleId: input.moduleId,
    });

    const title = input.title.trim() || '未命名任务';
    const record: CachedReportRecord = {
      id: input.id,
      title,
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
      moduleId: input.moduleId,
      outputMode: input.outputMode,
      status: 'queued',
      progressSnapshot: {
        progress: 0,
        currentStage: 'prepare',
        currentLabel: '排队中',
        currentEventLabel: '等待前序任务完成',
        status: 'idle',
      },
      taskMeta: {
        phase: 'prepare',
        message: '任务已创建，正在等待调度。',
        model: input.model,
        baseUrl: input.baseUrl,
        schedulerKey: input.schedulerKey,
      },
    };

    const currentState = this.getState();
    persistState(trimState({
      recordsById: {
        ...currentState.recordsById,
        [record.id]: record,
      },
      order: [record.id, ...currentState.order.filter((id) => id !== record.id)],
    }));

    logger.debug('Task record created', {
      id: record.id,
      title: record.title,
      status: record.status,
      totalRecords: Object.keys(currentState.recordsById).length + 1,
    });

    return record;
  },

  updateTaskRecord(reportId: string, updates: UpdateTaskRecordInput): CachedReportRecord {
    if (typeof window === 'undefined') {
      throw new Error('历史任务仅支持在浏览器环境中更新');
    }

    logger.debug('updateTaskRecord called', { reportId, updates });
    const currentState = this.getState();
    const currentRecord = currentState.recordsById[reportId];

    logger.debug('Current state', {
      reportId,
      recordExists: !!currentRecord,
      allRecordIds: Object.keys(currentState.recordsById),
    });

    if (!currentRecord) {
      logger.error('Record not found', undefined, {
        reportId,
        allRecordIds: Object.keys(currentState.recordsById),
      });
      throw new Error('未找到对应的历史任务');
    }

    const nextRecord: CachedReportRecord = {
      ...currentRecord,
      title: typeof updates.title === 'string' ? updates.title.trim() || currentRecord.title : currentRecord.title,
      status: updates.status ?? currentRecord.status,
      progressSnapshot: updates.progressSnapshot ?? currentRecord.progressSnapshot,
      taskMeta: {
        ...currentRecord.taskMeta,
        ...updates.taskMeta,
      },
      report: updates.report ?? currentRecord.report,
      updatedAt: new Date().toISOString(),
    };

    persistState({
      recordsById: {
        ...currentState.recordsById,
        [reportId]: nextRecord,
      },
      order: currentState.order,
    });

    logger.debug('Record updated', { reportId, newStatus: nextRecord.status });
    return nextRecord;
  },

  completeTask(reportId: string, report: PersistedAnalysisReport): CachedReportRecord {
    logger.debug('completeTask called', { reportId });
    const parsed = validatePersistedAnalysisReport(report);
    if (!parsed.success) {
      logger.error('Report validation failed', undefined, { error: parsed.error });
      throw new Error(parsed.error);
    }

    logger.debug('Report validated, calling updateTaskRecord');
    return this.updateTaskRecord(reportId, {
      title: getReportTitle(parsed.data),
      status: 'completed',
      progressSnapshot: {
        progress: 100,
        currentStage: 'normalize',
        currentLabel: '生成报告',
        currentEventLabel: '提交报告',
        status: 'completed',
      },
      taskMeta: {
        phase: 'normalize',
        message: '报告已生成',
        errorMessage: undefined,
        model: parsed.data.metadata.model,
        baseUrl: parsed.data.metadata.baseUrl,
      },
      report: parsed.data,
    });
  },

  failTask(reportId: string, errorMessage: string): CachedReportRecord {
    logger.debug('failTask called', { reportId, errorMessage });
    const currentState = this.getState();

    logger.debug('Current state', {
      reportId,
      recordExists: !!currentState.recordsById[reportId],
      allRecordIds: Object.keys(currentState.recordsById),
    });

    if (!currentState.recordsById[reportId]) {
      logger.error('Record not found in failTask', undefined, {
        reportId,
        allRecordIds: Object.keys(currentState.recordsById),
        order: currentState.order,
      });

      // 尝试从 localStorage 直接读取原始数据
      const rawState = localStorage.getItem(REPORT_HISTORY_STORAGE_KEY);
      logger.debug('Raw localStorage data', { rawState });

      throw new Error('未找到对应的历史任务');
    }

    const currentRecord = currentState.recordsById[reportId];

    logger.debug('Calling updateTaskRecord to fail task');
    return this.updateTaskRecord(reportId, {
      status: 'failed',
      progressSnapshot: {
        ...currentRecord.progressSnapshot,
        status: 'error',
        errorMessage,
      },
      taskMeta: {
        errorMessage,
      },
    });
  },

  markInterruptedTasksAsFailed(errorMessage: string): void {
    if (typeof window === 'undefined') {
      return;
    }

    const currentState = this.getState();
    let changed = false;
    const now = new Date().toISOString();
    const recordsById = Object.fromEntries(
      Object.entries(currentState.recordsById).map(([id, record]) => {
        if (record.status !== 'queued' && record.status !== 'running') {
          return [id, record];
        }

        changed = true;
        const nextRecord: CachedReportRecord = {
          ...record,
          status: 'failed',
          updatedAt: now,
          progressSnapshot: {
            ...record.progressSnapshot,
            status: 'error',
            errorMessage,
          },
          taskMeta: {
            ...record.taskMeta,
            errorMessage,
          },
        };

        return [id, nextRecord];
      }),
    );

    if (changed) {
      persistState({
        recordsById,
        order: currentState.order,
      });
    }
  },

  upsertReport(report: PersistedAnalysisReport): CachedReportRecord {
    if (typeof window === 'undefined') {
      return buildCachedRecord(report);
    }

    const parsed = validatePersistedAnalysisReport(report);
    if (!parsed.success) {
      throw new Error(parsed.error);
    }

    const currentState = this.getState();
    const record = buildCachedRecord(parsed.data);
    const nextState = trimState({
      recordsById: {
        ...currentState.recordsById,
        [record.id]: record,
      },
      order: [record.id, ...currentState.order.filter((id) => id !== record.id)],
    });

    persistState(nextState);
    return record;
  },

  getRecord(reportId: string): CachedReportRecord | null {
    return this.getState().recordsById[reportId] ?? null;
  },

  listReports(query: ReportHistoryQuery = {}): CachedReportRecord[] {
    const state = this.getState();
    let records = state.order
      .map((id) => state.recordsById[id])
      .filter((record): record is CachedReportRecord => Boolean(record));

    if (query.moduleId) {
      records = records.filter((record) => record.moduleId === query.moduleId);
    }

    if (query.outputMode) {
      records = records.filter((record) => record.outputMode === query.outputMode);
    }

    if (query.searchText?.trim()) {
      const keyword = query.searchText.trim().toLowerCase();
      records = records.filter((record) => {
        const fields = [
          record.title,
          record.id,
          record.taskMeta.model,
          record.moduleId,
          record.outputMode,
        ];

        return fields.some((value) => value.toLowerCase().includes(keyword));
      });
    }

    const sorted = sortRecords(records, query);
    return typeof query.limit === 'number' ? sorted.slice(0, query.limit) : sorted;
  },

  removeReport(reportId: string): void {
    if (typeof window === 'undefined') {
      return;
    }

    const currentState = this.getState();
    if (!currentState.recordsById[reportId]) {
      return;
    }

    const { [reportId]: _removed, ...recordsById } = currentState.recordsById;
    persistState({
      recordsById,
      order: currentState.order.filter((id) => id !== reportId),
    });
  },

  renameReport(reportId: string, title: string): CachedReportRecord {
    if (typeof window === 'undefined') {
      throw new Error('历史报告仅支持在浏览器环境中重命名');
    }

    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      throw new Error('报告标题不能为空');
    }

    const currentState = this.getState();
    const currentRecord = currentState.recordsById[reportId];
    if (!currentRecord) {
      throw new Error('未找到对应的历史报告');
    }

    const nextRecord: CachedReportRecord = {
      ...currentRecord,
      title: normalizedTitle,
      updatedAt: new Date().toISOString(),
    };

    persistState({
      recordsById: {
        ...currentState.recordsById,
        [reportId]: nextRecord,
      },
      order: currentState.order,
    });

    return nextRecord;
  },
};
