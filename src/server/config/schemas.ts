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
const readerPreferenceValues = [
  'fast_paced',
  'plot_driven',
  'character_emotion',
  'world_building',
  'literary_expression',
  'general_reader',
] as const;
const feedbackStyleValues = ['strict', 'balanced', 'encouraging'] as const;
const specialConstraintValues = [
  'keep_original_style',
  'avoid_overwriting',
  'focus_publishability',
  'focus_literary_expression',
] as const;

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
const readerPreferenceOptionSchema = createCatalogOptionSchema(readerPreferenceValues);
const feedbackStyleOptionSchema = createCatalogOptionSchema(feedbackStyleValues);
const specialConstraintOptionSchema = createCatalogOptionSchema(specialConstraintValues);

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
  readerPreferences: z.array(readerPreferenceOptionSchema),
  feedbackStyles: z.array(feedbackStyleOptionSchema),
  specialConstraints: z.array(specialConstraintOptionSchema),
});

export const evaluationDefaultsSchema = z.object({
  textType: z.enum(textTypeValues),
  textCompleteness: z.enum(textCompletenessValues),
  evaluationGoal: z.enum(evaluationGoalValues),
  readerPreference: z.enum(readerPreferenceValues).optional(),
  feedbackStyle: z.enum(feedbackStyleValues).optional(),
  specialConstraints: z.array(z.enum(specialConstraintValues)),
});

export const featureFlagsSchema = z.object({
  enableFileUpload: z.boolean(),
  enableGlobalSupplementBlocks: z.boolean(),
  enableLocalSupplements: z.boolean(),
  enableReaderPreference: z.boolean(),
  enableFeedbackStyle: z.boolean(),
  enableSpecialConstraints: z.boolean(),
});

function normalizeOptions<T extends string>(options: CatalogOption<T>[]) {
  return [...options].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    return left.label.localeCompare(right.label, 'zh-CN');
  });
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

export function validatePublishedOpsConfig(config: Omit<PublishedOpsConfig, 'source'>, source: PublishedOpsConfig['source'] = 'published'): PublishedOpsConfig {
  const parsedCatalog = evaluationCatalogSchema.parse(config.catalog);

  const normalizedConfig: PublishedOpsConfig = {
    source,
    manifest: manifestSchema.parse(config.manifest),
    site: siteSchema.parse(config.site),
    catalog: {
      textTypes: normalizeOptions(parsedCatalog.textTypes),
      textCompletenessOptions: normalizeOptions(parsedCatalog.textCompletenessOptions),
      evaluationGoals: normalizeOptions(parsedCatalog.evaluationGoals),
      readerPreferences: normalizeOptions(parsedCatalog.readerPreferences),
      feedbackStyles: normalizeOptions(parsedCatalog.feedbackStyles),
      specialConstraints: normalizeOptions(parsedCatalog.specialConstraints),
    },
    defaults: evaluationDefaultsSchema.parse(config.defaults),
    featureFlags: featureFlagsSchema.parse(config.featureFlags),
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
  ensureDefaultEnabled(
    normalizedConfig.catalog.readerPreferences,
    normalizedConfig.defaults.readerPreference,
    'readerPreference',
  );
  ensureDefaultEnabled(normalizedConfig.catalog.feedbackStyles, normalizedConfig.defaults.feedbackStyle, 'feedbackStyle');

  normalizedConfig.defaults.specialConstraints.forEach((constraint) => {
    ensureDefaultEnabled(normalizedConfig.catalog.specialConstraints, constraint, 'specialConstraints');
  });

  return normalizedConfig;
}
