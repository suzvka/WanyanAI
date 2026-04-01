/**
 * report-json 输出模式的数据验证
 * 
 * 验证模型输出是否符合 report-json 格式要求
 */

import { z } from 'zod';
import { reportRatingValues } from '@/config/reportScoring';
import { defaultSubscoreIds, type DefaultSubscoreId } from './subscores';

// 从 defaultSubscoreIds 派生 Schema 使用的值数组
const subscoreIdValues = defaultSubscoreIds as [DefaultSubscoreId, ...DefaultSubscoreId[]];

// === 模型输出类型（内部使用） ===

export const modelMinimalSummarySchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    overview: z.string().trim().min(1),
  })
  .strict();

export const modelMinimalSubscoreSchema = z
  .object({
    id: z.enum(subscoreIdValues),
    grade: z.enum(reportRatingValues),
    rationale: z.string().trim().min(1),
  })
  .strict();

export const modelMinimalConclusionSchema = z
  .object({
    rationale: z.string().trim().min(1),
  })
  .strict();

export const modelMinimalSectionSchema = z
  .object({
    title: z.string().trim().min(1),
    body: z.string().trim().min(1),
  })
  .strict();

export const modelMinimalSectionGroupSchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    title: z.string().trim().min(1),
    sections: z.array(modelMinimalSectionSchema).min(1),
  })
  .strict();

const modelMinimalReportBaseSchema = z
  .object({
    summary: modelMinimalSummarySchema,
    subscores: z.array(modelMinimalSubscoreSchema),
    conclusion: modelMinimalConclusionSchema,
    groups: z.array(modelMinimalSectionGroupSchema).min(1).optional(),
    // sections 已迁移到 groups 中，保留为可选以兼容旧格式
    sections: z.array(modelMinimalSectionSchema).min(1).optional(),
  })
  .strict();

type ModelMinimalReportSchemaInput = z.infer<typeof modelMinimalReportBaseSchema>;

/**
 * 模型输出报告验证 Schema
 * 
 * 验证规则：
 * - 必须包含 summary、subscores、conclusion
 * - subscores 必须包含所有 6 个维度，且无重复
 * - groups 或 sections 至少存在一个
 */
export const modelMinimalReportSchema = modelMinimalReportBaseSchema.superRefine(
  (report: ModelMinimalReportSchemaInput, ctx: z.RefinementCtx) => {
    // 验证 groups 或 sections 至少存在一个
    const hasGroups = report.groups && report.groups.length > 0;
    const hasSections = report.sections && report.sections.length > 0;
    
    if (!hasGroups && !hasSections) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '必须包含 groups 或 sections 字段',
        path: ['groups'],
      });
    }

    // 验证子维度
    const seen = new Set<string>();

    report.subscores.forEach((subscore, index) => {
      if (seen.has(subscore.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `子维度 ${subscore.id} 重复`,
          path: ['subscores', index, 'id'],
        });
        return;
      }
      seen.add(subscore.id);
    });

    // 检查是否包含所有必需的子维度
    for (const id of defaultSubscoreIds) {
      if (!seen.has(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `缺少子维度 ${id}`,
          path: ['subscores'],
        });
      }
    }

    // 检查子维度数量
    if (report.subscores.length !== defaultSubscoreIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `子维度数量必须为 ${defaultSubscoreIds.length} 项`,
        path: ['subscores'],
      });
    }
  },
);

// === 导出类型 ===

/** 模型输出的摘要 */
export type ModelMinimalSummary = z.infer<typeof modelMinimalSummarySchema>;

/** 模型输出的子维度 */
export type ModelMinimalSubscore = z.infer<typeof modelMinimalSubscoreSchema>;

/** 模型输出的结论 */
export type ModelMinimalConclusion = z.infer<typeof modelMinimalConclusionSchema>;

/** 模型输出的章节 */
export type ModelMinimalSection = z.infer<typeof modelMinimalSectionSchema>;

/** 模型输出的章节组 */
export type ModelMinimalSectionGroup = z.infer<typeof modelMinimalSectionGroupSchema>;

/** 模型输出的完整报告 */
export type ModelMinimalReport = z.infer<typeof modelMinimalReportBaseSchema>;

// === 验证接口 ===

/** 验证结果 */
export type ValidationResult = {
  success: boolean;
  data?: ModelMinimalReport;
  errors?: Array<{ path: string; message: string }>;
};

/** 验证诊断信息 */
export type ValidationDiagnostics = {
  isValid: boolean;
  errorCount: number;
  errors: Array<{ path: string; message: string }>;
};

/**
 * 验证模型输出数据
 */
export function validate(data: unknown): ValidationResult {
  const result = modelMinimalReportSchema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errors = result.error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
  
  return { success: false, errors };
}

/**
 * 获取验证诊断信息
 */
export function getValidationDiagnostics(data: unknown): ValidationDiagnostics {
  const result = validate(data);
  
  if (result.success) {
    return { isValid: true, errorCount: 0, errors: [] };
  }
  
  return {
    isValid: false,
    errorCount: result.errors?.length ?? 0,
    errors: result.errors ?? [],
  };
}
