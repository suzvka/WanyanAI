import { z } from 'zod';
import type { AnalysisControlsInput, PublishedOpsConfig } from './types';

const configTextSchema = z.string();

const analysisControlOptionSchema = z.object({
  value: z.string().trim().min(1),
  label: configTextSchema,
  promptText: configTextSchema,
  enabled: z.boolean(),
});

const analysisControlSchema = z.object({
  id: z.string().trim().min(1),
  title: configTextSchema,
  enabled: z.boolean(),
  options: z.array(analysisControlOptionSchema),
});

const analysisControlGroupSchema = z.object({
  id: z.string().trim().min(1),
  title: configTextSchema,
  description: z.string().optional(),
  enabled: z.boolean(),
  controls: z.array(analysisControlSchema),
});

const analysisControlsSchemaBase = z.object({
  groups: z.array(analysisControlGroupSchema).optional(),
  controls: z.array(analysisControlSchema).optional(),
});

type AnalysisControlOption = {
  value: string;
  label: string;
  promptText: string;
  enabled: boolean;
};

type AnalysisControl = {
  id: string;
  title: string;
  enabled: boolean;
  options: AnalysisControlOption[];
};

type AnalysisControlGroup = {
  id: string;
  title: string;
  description?: string;
  enabled: boolean;
  controls: AnalysisControl[];
};

type AnalysisControlsConfigLike = {
  groups?: AnalysisControlGroup[];
  controls?: AnalysisControl[];
};

function cloneControl(control: AnalysisControl) {
  return {
    ...control,
    options: control.options.map((option: AnalysisControlOption) => ({ ...option })),
  };
}

function normalizeAnalysisControls(config: AnalysisControlsConfigLike): PublishedOpsConfig['analysisControls'] {
  const sourceGroups: AnalysisControlGroup[] | null = config.groups && config.groups.length > 0 ? config.groups : null;

  if (sourceGroups) {
    const groups = sourceGroups.map((group: AnalysisControlGroup) => ({
      ...group,
      description: group.description?.trim() || undefined,
      controls: group.controls.filter((control: AnalysisControl) => control.enabled).map(cloneControl),
    }));

    return {
      groups,
      controls: groups.flatMap((group: AnalysisControlGroup) => group.controls.map(cloneControl)),
    };
  }

  const controls = (config.controls ?? []).filter((control: AnalysisControl) => control.enabled).map(cloneControl);

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

export const manifestSchema = z.object({
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
  (value: AnalysisControlsConfigLike, ctx: z.RefinementCtx) => {
    const seenGroupIds = new Set<string>();
    const seenControlIds = new Set<string>();
    const groups = value.groups && value.groups.length > 0 ? value.groups : null;
    const controls: AnalysisControl[] = groups ? groups.flatMap((group: AnalysisControlGroup) => group.controls) : value.controls ?? [];

    groups?.forEach((group: AnalysisControlGroup, groupIndex: number) => {
      if (seenGroupIds.has(group.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `动态检查项分组 ID 重复：${group.id}`,
          path: ['groups', groupIndex, 'id'],
        });
      }
      seenGroupIds.add(group.id);
    });

    controls.forEach((control: AnalysisControl, controlIndex: number) => {
      if (seenControlIds.has(control.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `动态检查项 ID 重复：${control.id}`,
          path: ['controls', controlIndex, 'id'],
        });
      }
      seenControlIds.add(control.id);

      const seenOptionValues = new Set<string>();
      control.options.forEach((option: AnalysisControlOption, optionIndex: number) => {
        if (seenOptionValues.has(option.value)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `动态检查项选项值重复：${option.value}`,
            path: ['controls', controlIndex, 'options', optionIndex, 'value'],
          });
        }
        seenOptionValues.add(option.value);
      });
    });
  },
);

type PublishedOpsConfigInput = {
  manifest: Parameters<typeof manifestSchema.parse>[0];
  site: Parameters<typeof siteSchema.parse>[0];
  featureFlags: Parameters<typeof featureFlagsSchema.parse>[0];
  analysisControls: AnalysisControlsInput;
  appearance: Parameters<typeof appearanceSchema.parse>[0];
};

export function validatePublishedOpsConfig(config: PublishedOpsConfigInput, source: PublishedOpsConfig['source'] = 'published'): PublishedOpsConfig {
  const parsedAnalysisControls = analysisControlsSchema.parse(config.analysisControls);

  const normalizedConfig: PublishedOpsConfig = {
    source,
    manifest: manifestSchema.parse(config.manifest),
    site: siteSchema.parse(config.site),
    featureFlags: featureFlagsSchema.parse(config.featureFlags),
    analysisControls: normalizeAnalysisControls(parsedAnalysisControls),
    appearance: appearanceSchema.parse(config.appearance),
  };

  return normalizedConfig;
}
