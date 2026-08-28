import { z } from 'zod';
import type { PageModuleManifest, ContainerConfig, ContainerValidationError } from '@/types/module';

/**
 * 容器配置 Schema
 */
export const containerConfigSchema = z.object({
  type: z.string().trim().min(1),
  params: z.record(z.string(), z.unknown()).optional(),
});

/**
 * text-blocks 容器参数 Schema
 */
export const textBlocksParamsSchema = z.object({
  blockType: z.string().trim().min(1),
  defaultExpanded: z.boolean().optional().default(false),
  initialBlockCount: z.number().int().min(0).optional().default(1),
});

const pageModuleLandingSchema = z.object({
  tagline: z.string().trim().min(1).optional(),
  highlights: z.array(z.string().trim().min(1)).max(4).optional(),
  accent: z.enum(['primary', 'violet', 'blue', 'green', 'amber']).optional(),
});

const pageModuleEntrySchema = z.object({
  enabled: z.boolean().default(true),
  icon: z.string().trim().min(1).optional(),
  order: z.number().int().default(0),
  landing: pageModuleLandingSchema.optional(),
});

/**
 * 页面模块注册配置 Schema
 *
 * 只校验框架必需字段，其余字段（如 agent）由 TypeScript 类型和
 * 独立的 validateAgentPipeline() 负责校验，避免 Zod 静默丢弃。
 */
export const moduleManifestSchema: z.ZodType<PageModuleManifest> = z.object({
  slug: z.string().trim().min(1),
  title: z.string().trim().min(1),
  description: z.string().optional(),
  route: z.string().trim().min(1),
  containers: z.array(containerConfigSchema).min(1),
  outputMode: z.string().trim().min(1),
  entry: pageModuleEntrySchema,
  // features 已废弃但保持向后兼容
  features: z
    .object({
      textBlocks: z.boolean(),
      fileUpload: z.boolean(),
      annotations: z.boolean(),
    })
    .optional(),
}).passthrough();

/**
 * 验证模块注册配置
 */
export function validatePageModuleManifest(data: unknown): PageModuleManifest {
  return moduleManifestSchema.parse(data);
}

/**
 * 验证容器配置完整性
 * @param manifest 模块配置
 * @param registeredContainerTypes 已注册的容器类型列表
 * @param registeredOutputModes 已注册的输出模式列表
 * @returns 验证错误列表，空数组表示验证通过
 */
export function validatePageModuleContainers(
  manifest: PageModuleManifest,
  registeredContainerTypes: string[],
  registeredOutputModes: string[],
): ContainerValidationError[] {
  const errors: ContainerValidationError[] = [];

  // 1. 检查 containers 是否包含 analysis-controls
  const hasAnalysisControls = manifest.containers.some(
    (c: ContainerConfig) => c.type === 'analysis-controls',
  );
  if (!hasAnalysisControls) {
    errors.push({
      field: 'containers',
      message: '必须包含 analysis-controls 容器',
    });
  }

  // 2. 检查容器类型是否已注册
  for (let i = 0; i < manifest.containers.length; i++) {
    const container = manifest.containers[i];
    if (!registeredContainerTypes.includes(container.type)) {
      errors.push({
        field: `containers[${i}].type`,
        message: `未注册的容器类型: ${container.type}`,
      });
    }
  }

  // 3. 检查 outputMode 是否有效
  if (!registeredOutputModes.includes(manifest.outputMode)) {
    errors.push({
      field: 'outputMode',
      message: `无效的输出模式: ${manifest.outputMode}`,
    });
  }

  return errors;
}

/**
 * 验证 text-blocks 容器参数
 */
export function validateTextBlocksParams(
  params: unknown,
): { success: true; data: z.infer<typeof textBlocksParamsSchema> } | { success: false; errors: string[] } {
  const result = textBlocksParamsSchema.safeParse(params);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    errors: result.error.issues.map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`),
  };
}
