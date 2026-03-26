import { z } from 'zod';
import type { PublishedOpsConfig, CatalogOption } from './types';

const textTypeValues = ['web_serial', 'short_story', 'light_novel', 'literary_submission', 'general_text'] as const;
const textCompletenessValues = ['complete', 'single_chapter', 'first_chapters', 'excerpt', 'draft'] as const;
const evaluationGoalValues = [
  'overall_check',
  'opening_attraction',
  'rhythm_progression',
  'character_development',
  'style_consistency',
  'structure_completeness',
  'reader_acceptance',
] as const;
const analysisControlBindingValues = ['textType', 'textCompleteness', 'evaluationGoal'] as const;

function createCatalogOptionSchema<TValues extends readonly [string, ...string[]]>(values: TValues) {
  return z.object({
    value: z.enum(values),
    label: z.string().trim().min(1),
    description: z.string(),
    enabled: z.boolean(),
    sortOrder: z.number(),
    badge: z.string().trim().min(1).optional(),
    recommended: z.boolean().optional(),
  });
}

const textTypeOptionSchema = createCatalogOptionSchema(textTypeValues);
const textCompletenessOptionSchema = createCatalogOptionSchema(textCompletenessValues);
const evaluationGoalOptionSchema = createCatalogOptionSchema(evaluationGoalValues);

const analysisControlOptionSchema = z.object({
  value: z.string().trim().min(1),
  label: z.string().trim().min(1),
  promptText: z.string(),
  enabled: z.boolean(),
});

const analysisControlSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  enabled: z.boolean(),
  sortOrder: z.number(),
  bindTo: z.enum(analysisControlBindingValues).optional(),
  appliesTo: z.array(z.enum(evaluationGoalValues)).min(1),
  options: z.array(analysisControlOptionSchema).min(1),
});

const analysisControlsSchemaBase = z.object({
  controls: z.array(analysisControlSchema),
});

export const manifestSchema = z.object({
  configVersion: z.string().trim().min(1),
  publishedAt: z.string().trim().min(1),
  publishedBy: z.string().trim().min(1),
  environment: z.enum(['production', 'staging', 'local']),
});

export const siteSchema = z.object({
  home: z.object({
    title: z.string().trim().min(1),
    subtitle: z.string().trim().min(1),
    modelHint: z.string().trim().min(1),
  }),
  inputPanel: z.object({
    title: z.string().trim().min(1),
    description: z.string().trim().min(1),
  }),
  settingsPanel: z.object({
    title: z.string().trim().min(1),
    description: z.string().trim().min(1),
  }),
  progress: z.object({
    runningTitle: z.string().trim().min(1),
    runningDescription: z.string().trim().min(1),
  }),
  errors: z.object({
    generic: z.string().trim().min(1),
  }),
});

export const evaluationCatalogSchema = z.object({
  textTypes: z.array(textTypeOptionSchema),
  textCompletenessOptions: z.array(textCompletenessOptionSchema),
  evaluationGoals: z.array(evaluationGoalOptionSchema),
});

export const evaluationDefaultsSchema = z.object({
  textType: z.enum(textTypeValues),
  textCompleteness: z.enum(textCompletenessValues),
  evaluationGoal: z.enum(evaluationGoalValues),
});

export const featureFlagsSchema = z.object({
  enableFileUpload: z.boolean(),
  enableAnnotations: z.boolean(),
});

export const analysisControlsSchema = analysisControlsSchemaBase.superRefine(
  (value: z.infer<typeof analysisControlsSchemaBase>, ctx: z.RefinementCtx) => {
    const seenControlIds = new Set<string>();
    const boundControls = new Map<(typeof analysisControlBindingValues)[number], string>();

    value.controls.forEach((control: z.infer<typeof analysisControlSchema>, controlIndex: number) => {
      if (seenControlIds.has(control.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `动态检查项 ID 重复：${control.id}`,
          path: ['controls', controlIndex, 'id'],
        });
      }
      seenControlIds.add(control.id);

      if (control.bindTo) {
        const existingControlId = boundControls.get(control.bindTo);

        if (existingControlId) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `核心分析设置 ${control.bindTo} 只能绑定一个控件，当前重复：${existingControlId} / ${control.id}`,
            path: ['controls', controlIndex, 'bindTo'],
          });
        }

        boundControls.set(control.bindTo, control.id);
      }

      if (!control.options[0]?.enabled) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '动态检查项的首个选项必须启用，用于表达默认值。',
          path: ['controls', controlIndex, 'options', 0, 'enabled'],
        });
      }

      const seenOptionValues = new Set<string>();
      control.options.forEach((option: z.infer<typeof analysisControlOptionSchema>, optionIndex: number) => {
        const bindTo = control.bindTo;

        const validBoundOption =
          bindTo === 'textType'
            ? textTypeValues.includes(option.value as (typeof textTypeValues)[number])
            : bindTo === 'textCompleteness'
              ? textCompletenessValues.includes(option.value as (typeof textCompletenessValues)[number])
              : bindTo === 'evaluationGoal'
                ? evaluationGoalValues.includes(option.value as (typeof evaluationGoalValues)[number])
                : true;

        if (bindTo && !validBoundOption) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `核心分析设置 ${bindTo} 的选项值不合法：${option.value}`,
            path: ['controls', controlIndex, 'options', optionIndex, 'value'],
          });
        }

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

    analysisControlBindingValues.forEach((binding) => {
      if (!boundControls.has(binding)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `缺少核心分析设置控件：${binding}`,
          path: ['controls'],
        });
      }
    });
  },
);

function normalizeOptions<T extends string>(options: CatalogOption<T>[]) {
  return [...options].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    return left.label.localeCompare(right.label, 'zh-CN');
  });
}

function ensureBoundAnalysisControlsAlwaysVisible(config: PublishedOpsConfig) {
  config.analysisControls.controls.forEach((control) => {
    if (!control.bindTo) {
      return;
    }

    const missingGoals = evaluationGoalValues.filter((goal) => !control.appliesTo.includes(goal));

    if (missingGoals.length > 0) {
      throw new Error(`核心分析设置 ${control.id} 必须对所有报告类型可见：缺少 ${missingGoals.join(', ')}`);
    }
  });
}

function normalizeAnalysisControls(config: PublishedOpsConfig['analysisControls']): PublishedOpsConfig['analysisControls'] {
  return {
    controls: [...config.controls]
      .sort((left, right) => {
        if (left.sortOrder !== right.sortOrder) {
          return left.sortOrder - right.sortOrder;
        }

        return left.title.localeCompare(right.title, 'zh-CN');
      })
      .map((control) => ({
        ...control,
        appliesTo: [...control.appliesTo],
        options: control.options.map((option) => ({ ...option })),
      })),
  };
}

function ensureEnabledOption<T extends string>(options: CatalogOption<T>[], fieldName: string) {
  if (!options.some((option) => option.enabled)) {
    throw new Error(`${fieldName} 至少需要保留一个启用项`);
  }
}

function ensureDefaultEnabled<T extends string>(options: CatalogOption<T>[], value: T | undefined, fieldName: string) {
  if (!value) {
    return;
  }

  const target = options.find((option) => option.value === value);
  if (!target) {
    throw new Error(`${fieldName} 默认值不存在：${value}`);
  }

  if (!target.enabled) {
    throw new Error(`${fieldName} 默认值已被禁用：${value}`);
  }
}

function ensureAnalysisControlsTargetEnabledGoals(config: PublishedOpsConfig) {
  const enabledGoals = new Set(
    config.catalog.evaluationGoals.filter((option) => option.enabled).map((option) => option.value),
  );

  config.analysisControls.controls.forEach((control) => {
    control.appliesTo.forEach((goal) => {
      if (!enabledGoals.has(goal)) {
        throw new Error(`动态检查项 ${control.id} 依赖了未启用的报告类型：${goal}`);
      }
    });
  });
}

export function validatePublishedOpsConfig(config: Omit<PublishedOpsConfig, 'source'>, source: PublishedOpsConfig['source'] = 'published'): PublishedOpsConfig {
  const parsedCatalog = evaluationCatalogSchema.parse(config.catalog);
  const parsedAnalysisControls = analysisControlsSchema.parse(config.analysisControls);

  const normalizedConfig: PublishedOpsConfig = {
    source,
    manifest: manifestSchema.parse(config.manifest),
    site: siteSchema.parse(config.site),
    catalog: {
      textTypes: normalizeOptions(parsedCatalog.textTypes),
      textCompletenessOptions: normalizeOptions(parsedCatalog.textCompletenessOptions),
      evaluationGoals: normalizeOptions(parsedCatalog.evaluationGoals),
    },
    defaults: evaluationDefaultsSchema.parse(config.defaults),
    featureFlags: featureFlagsSchema.parse(config.featureFlags),
    analysisControls: normalizeAnalysisControls(parsedAnalysisControls),
  };

  ensureEnabledOption(normalizedConfig.catalog.textTypes, 'textTypes');
  ensureEnabledOption(normalizedConfig.catalog.textCompletenessOptions, 'textCompletenessOptions');
  ensureEnabledOption(normalizedConfig.catalog.evaluationGoals, 'evaluationGoals');

  ensureDefaultEnabled(normalizedConfig.catalog.textTypes, normalizedConfig.defaults.textType, 'textType');
  ensureDefaultEnabled(
    normalizedConfig.catalog.textCompletenessOptions,
    normalizedConfig.defaults.textCompleteness,
    'textCompleteness',
  );
  ensureDefaultEnabled(normalizedConfig.catalog.evaluationGoals, normalizedConfig.defaults.evaluationGoal, 'evaluationGoal');

  ensureAnalysisControlsTargetEnabledGoals(normalizedConfig);
  ensureBoundAnalysisControlsAlwaysVisible(normalizedConfig);

  return normalizedConfig;
}
