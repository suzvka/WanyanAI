import { z } from 'zod';

export const reportScoringContextSchema = z.object({
  multipliers: z.record(z.string(), z.number()).default({}),
  defaultMultiplier: z.number(),
});

export const analysisReportMetadataSchema = z.object({
  model: z.string().trim().min(1, '模型名称不能为空'),
  baseUrl: z.string().trim().min(1, 'Base URL 不能为空'),
  outputMode: z.string().trim().min(1, '输出模式不能为空'),
  moduleId: z.string().trim().min(1, '模块 ID 不能为空'),
});

export const persistedAnalysisReportSchema = z.object({
  reportId: z.string().trim().min(1, '报告 ID 不能为空'),
  moduleId: z.string().trim().min(1, '模块 ID 不能为空'),
  outputMode: z.string().trim().min(1, '输出模式不能为空'),
  createdAt: z.string().trim().min(1, '创建时间不能为空'),
  rawJson: z.unknown(),
  metadata: analysisReportMetadataSchema,
  scoringContext: reportScoringContextSchema,
});

export const progressSnapshotSchema = z.object({
  progress: z.number().int().min(0).max(100),
  currentStage: z.string().nullable(),
  currentLabel: z.string(),
  currentEventLabel: z.string().optional(),
  status: z.enum(['idle', 'running', 'completed', 'error']),
  errorMessage: z.string().optional(),
});

export const analysisTaskMetaSchema = z.object({
  phase: z.enum(['prepare', 'fetch-template', 'build-prompt', 'request-model', 'parse-mcp', 'invoke-tool', 'extract-json', 'repair-json', 'normalize']),
  message: z.string().optional(),
  model: z.string().trim().min(1, '模型名称不能为空'),
  baseUrl: z.string().trim().min(1, 'Base URL 不能为空'),
  schedulerKey: z.string().trim().min(1, '调度键不能为空'),
  errorMessage: z.string().optional(),
});

export const cachedReportRecordSchema = z.object({
  id: z.string().trim().min(1, '缓存记录 ID 不能为空'),
  title: z.string().trim().min(1, '报告标题不能为空'),
  createdAt: z.string().trim().min(1, '创建时间不能为空'),
  updatedAt: z.string().trim().min(1, '更新时间不能为空'),
  moduleId: z.string().trim().min(1, '模块 ID 不能为空'),
  outputMode: z.string().trim().min(1, '输出模式不能为空'),
  status: z.enum(['queued', 'running', 'completed', 'failed']),
  progressSnapshot: progressSnapshotSchema,
  taskMeta: analysisTaskMetaSchema,
  report: persistedAnalysisReportSchema.optional(),
});

export const reportHistoryStoreStateSchema = z.object({
  recordsById: z.record(z.string(), cachedReportRecordSchema).default({}),
  order: z.array(z.string()).default([]),
});

export type PersistedAnalysisReportSchema = z.infer<typeof persistedAnalysisReportSchema>;
export type CachedReportRecordSchema = z.infer<typeof cachedReportRecordSchema>;
export type ReportHistoryStoreStateSchema = z.infer<typeof reportHistoryStoreStateSchema>;

export function validatePersistedAnalysisReport(input: unknown):
  | { success: true; data: PersistedAnalysisReportSchema }
  | { success: false; error: string } {
  const result = persistedAnalysisReportSchema.safeParse(input);

  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }

  return {
    success: false,
    error: result.error.issues[0]?.message || '报告缓存校验失败',
  };
}

export function validateReportHistoryStoreState(input: unknown):
  | { success: true; data: ReportHistoryStoreStateSchema }
  | { success: false; error: string } {
  const result = reportHistoryStoreStateSchema.safeParse(input);

  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }

  return {
    success: false,
    error: result.error.issues[0]?.message || '历史报告缓存校验失败',
  };
}
