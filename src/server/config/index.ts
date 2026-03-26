import 'server-only';

import { createDefaultEvaluationInput } from '@/config/defaults';
import type { EvaluationInput } from '@/types/report';
import type { PublishedOpsConfig } from './types';

export { getPublishedOpsConfig } from './loader';
export type {
  AnalysisControlBinding,
  AnalysisControlConfig,
  AnalysisControlsConfig,
  AnalysisControlOptionConfig,
  CatalogOption,
  EvaluationCatalogConfig,
  EvaluationDefaultsConfig,
  FeatureFlagsConfig,
  OpsConfigManifest,
  PublishedOpsConfig,
  SiteConfig,
} from './types';

export function getEnabledAnalysisControlsForEvaluationGoal(config: PublishedOpsConfig, evaluationGoal: EvaluationInput['evaluationGoal']) {
  return config.analysisControls.controls.filter(
    (control) => control.enabled && control.appliesTo.includes(evaluationGoal),
  );
}

export function createInitialEvaluationInputFromConfig(config: PublishedOpsConfig): EvaluationInput {
  return createDefaultEvaluationInput({
    textType: config.defaults.textType,
    textCompleteness: config.defaults.textCompleteness,
    evaluationGoal: config.defaults.evaluationGoal,
  });
}
