import { z } from 'zod';
import type {
  AnalysisControlGroupInput,
  AnalysisControlInput,
  AnalysisControlOptionInput,
  AnalysisControlsConfig,
  AnalysisControlsInput,
  SiteConfig,
} from './types';
import type { PlatformConfig } from '@/types/platform';

const configTextSchema = z.string();

const analysisControlOptionSchema = z.object({
  value: z.string().trim().min(1).optional(),
  label: configTextSchema,
  promptText: configTextSchema.optional(),
  enabled: z.boolean().optional(),
}).passthrough();

const analysisControlSchema = z.object({
  id: z.string().trim().min(1),
  title: configTextSchema,
  enabled: z.boolean().optional(),
  options: z.array(analysisControlOptionSchema),
});

const analysisControlGroupSchema = z.object({
  id: z.string().trim().min(1),
  title: configTextSchema,
  description: z.string().optional(),
  enabled: z.boolean().optional(),
  controls: z.array(analysisControlSchema),
});

const analysisControlsSchemaBase = z.object({
  groups: z.array(analysisControlGroupSchema).optional(),
  controls: z.array(analysisControlSchema).optional(),
});

function resolveOptionValue(option: AnalysisControlOptionInput): string {
  return option.value?.trim() || option.label.trim();
}

function normalizeOption(option: AnalysisControlOptionInput) {
  return {
    ...option,
    value: resolveOptionValue(option),
    promptText: option.promptText ?? '',
    enabled: option.enabled ?? true,
  };
}

function cloneControl(control: AnalysisControlsConfig['controls'][number]) {
  return {
    ...control,
    options: control.options.map((option) => ({ ...option })),
  };
}

function normalizeControl(control: AnalysisControlInput): AnalysisControlsConfig['controls'][number] {
  return {
    ...control,
    enabled: control.enabled ?? true,
    options: control.options.map(normalizeOption).filter((option) => option.enabled),
  };
}

function normalizeGroup(group: AnalysisControlGroupInput): AnalysisControlsConfig['groups'][number] {
  return {
    ...group,
    description: group.description?.trim() || undefined,
    enabled: group.enabled ?? true,
    controls: group.controls.map(normalizeControl).filter((control) => control.enabled),
  };
}

export function normalizeAnalysisControls(config: AnalysisControlsInput): AnalysisControlsConfig {
  const sourceGroups = config.groups && config.groups.length > 0 ? config.groups : null;

  if (sourceGroups) {
    const groups = sourceGroups.map(normalizeGroup);

    return {
      groups,
      controls: groups.flatMap((group) => group.controls.map(cloneControl)),
    };
  }

  const controls = (config.controls ?? []).map(normalizeControl).filter((control) => control.enabled);

  return {
    groups: [
      {
        id: 'default',
        title: '默认分组',
        description: undefined,
        enabled: true,
        controls,
      },
    ],
    controls: controls.map(cloneControl),
  };
}

export const platformManifestSchema = z.object({
  configVersion: z.string().trim().min(1),
  publishedAt: z.string().trim().min(1),
  publishedBy: z.string().trim().min(1),
  environment: z.enum(['production', 'staging', 'local']),
});

export const siteSchema = z.object({
  home: z.object({
    title: configTextSchema,
    subtitle: configTextSchema,
  }),
  inputPanel: z.object({
    title: configTextSchema,
    description: configTextSchema,
  }),
  settingsPanel: z.object({
    title: configTextSchema,
    description: configTextSchema,
  }),
  progress: z.object({
    runningTitle: configTextSchema,
    runningDescription: configTextSchema,
  }),
});

export const featureFlagsSchema = z.object({
  enableFileUpload: z.boolean(),
  enableAnnotations: z.boolean(),
});

export const appearanceBrandSchema = z.object({
  name: z.string().trim().min(1),
  slogan: z.string().optional(),
  fontFamily: z.string().optional(),
});

export const appearanceBackgroundOpacitySchema = z.object({
  light: z.number().min(0).max(1),
  dark: z.number().min(0).max(1),
});

export const appearanceBrandColorOffsetSchema = z.object({
  light: z.number().min(-1).max(1),
  dark: z.number().min(-1).max(1),
});

export const appearanceThemeSchema = z.object({
  primary: z.string().regex(/^#[0-9a-fA-F]{6}$/, '主题色必须是有效的 HEX 颜色值'),
  backgroundOpacity: appearanceBackgroundOpacitySchema,
  brandColorOffset: appearanceBrandColorOffsetSchema,
});

export const appearanceSchema = z.object({
  brand: appearanceBrandSchema,
  theme: appearanceThemeSchema,
});

export const analysisControlsSchema = analysisControlsSchemaBase.superRefine(
  (value: AnalysisControlsInput, ctx: z.RefinementCtx) => {
    const seenGroupIds = new Set<string>();
    const seenControlIds = new Set<string>();
    const groups = value.groups && value.groups.length > 0 ? value.groups : null;
    const controls = groups ? groups.flatMap((group) => group.controls) : value.controls ?? [];

    groups?.forEach((group, groupIndex: number) => {
      if (seenGroupIds.has(group.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `动态检查项分组 ID 重复：${group.id}`,
          path: ['groups', groupIndex, 'id'],
        });
      }
      seenGroupIds.add(group.id);
    });

    controls.forEach((control, controlIndex: number) => {
      if (seenControlIds.has(control.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `动态检查项 ID 重复：${control.id}`,
          path: ['controls', controlIndex, 'id'],
        });
      }
      seenControlIds.add(control.id);

      const seenOptionValues = new Set<string>();
      control.options.forEach((option, optionIndex: number) => {
        const optionValue = resolveOptionValue(option);

        if (seenOptionValues.has(optionValue)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `动态检查项选项值重复：${optionValue}`,
            path: ['controls', controlIndex, 'options', optionIndex, 'value'],
          });
        }
        seenOptionValues.add(optionValue);
      });
    });
  },
);

/**
 * 验证站点配置
 */
export function validateSiteConfig(data: unknown): SiteConfig {
  return siteSchema.parse(data);
}

/**
 * 验证分析控制配置
 */
export function validateAnalysisControls(data: unknown): AnalysisControlsConfig {
  const parsed = analysisControlsSchema.parse(data);
  return normalizeAnalysisControls(parsed);
}

/**
 * 验证平台配置
 */
export function validatePlatformConfig(data: {
  manifest: unknown;
  appearance: unknown;
  featureFlags: unknown;
}, source: PlatformConfig['source'] = 'published'): PlatformConfig {
  return {
    source,
    manifest: platformManifestSchema.parse(data.manifest),
    appearance: appearanceSchema.parse(data.appearance),
    featureFlags: featureFlagsSchema.parse(data.featureFlags),
  };
}
