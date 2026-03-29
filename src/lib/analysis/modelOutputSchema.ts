import { z } from 'zod';
import { modelSubscoreIdValues } from '@/types/analysis';
import { reportRatingValues } from '@/config/reportScoring';

export const modelMinimalSummarySchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    overview: z.string().trim().min(1),
  })
  .strict();

export const modelMinimalSubscoreSchema = z
  .object({
    id: z.enum(modelSubscoreIdValues),
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

    const seen = new Set<string>();

    report.subscores.forEach((subscore: ModelMinimalReportSchemaInput['subscores'][number], index: number) => {
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

    for (const id of modelSubscoreIdValues) {
      if (!seen.has(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `缺少子维度 ${id}`,
          path: ['subscores'],
        });
      }
    }

    if (report.subscores.length !== modelSubscoreIdValues.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `子维度数量必须为 ${modelSubscoreIdValues.length} 项`,
        path: ['subscores'],
      });
    }
  },
);
