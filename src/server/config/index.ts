import 'server-only';

import { createDefaultEvaluationInput } from '@/config/defaults';
import type { EvaluationInput } from '@/types/report';
import type { PublishedOpsConfig } from './types';

export { getPublishedOpsConfig } from './loader';
export type {
  CatalogOption,
  EvaluationCatalogConfig,
  EvaluationDefaultsConfig,
  FeatureFlagsConfig,
  OpsConfigManifest,
  PublishedOpsConfig,
  SiteConfig,
} from './types';

export function createInitialEvaluationInputFromConfig(config: PublishedOpsConfig): EvaluationInput {
  return createDefaultEvaluationInput({
    textType: config.defaults.textType,
    textCompleteness: config.defaults.textCompleteness,
    evaluationGoal: config.defaults.evaluationGoal,
    readerPreference: config.featureFlags.enableReaderPreference ? config.defaults.readerPreference : undefined,
    feedbackStyle: config.featureFlags.enableFeedbackStyle ? config.defaults.feedbackStyle : undefined,
    specialConstraints: config.featureFlags.enableSpecialConstraints ? config.defaults.specialConstraints : [],
  });
}
