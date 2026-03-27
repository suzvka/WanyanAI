import { z } from 'zod';
import {
  evaluationGoalValues,
  textCompletenessValues,
  textTypeValues,
} from '@/config/evaluationDimensions';
import type { PublishedOpsConfig } from './types';

const analysisControlBindingValues = ['textType', 'textCompleteness', 'evaluationGoal'] as const;
const configTextSchema = z.string();
const boundControlOptionValues: Record<(typeof analysisControlBindingValues)[number], readonly string[]> = {
  textType: textTypeValues,
  textCompleteness: textCompletenessValues,
  evaluationGoal: evaluationGoalValues,
};

function isValidBoundControlOption(
  binding: (typeof analysisControlBindingValues)[number],
  value: string,
) {
  return boundControlOptionValues[binding].includes(value);
}

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

        const validBoundOption = bindTo ? isValidBoundControlOption(bindTo, option.value) : true;

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

export function validatePublishedOpsConfig(config: Omit<PublishedOpsConfig, 'source'>, source: PublishedOpsConfig['source'] = 'published'): PublishedOpsConfig {
  const parsedAnalysisControls = analysisControlsSchema.parse(config.analysisControls);

  const normalizedConfig: PublishedOpsConfig = {
    source,
    manifest: manifestSchema.parse(config.manifest),
    site: siteSchema.parse(config.site),
    defaults: evaluationDefaultsSchema.parse(config.defaults),
    featureFlags: featureFlagsSchema.parse(config.featureFlags),
    analysisControls: normalizeAnalysisControls(parsedAnalysisControls),
  };

  ensureBoundAnalysisControlsAlwaysVisible(normalizedConfig);

  return normalizedConfig;
}
