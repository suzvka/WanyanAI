import 'server-only';

import { createDefaultEvaluationInput } from '@/config/defaults';
import type { EvaluationInput } from '@/types/report';
import type { PublishedOpsConfig } from './types';

export { getPublishedOpsConfig } from './loader';
export type {
  AnalysisControlConfig,
  AnalysisControlsConfig,
  AnalysisControlOptionConfig,
  AnalysisControlsInput,
  AppearanceBackgroundOpacityConfig,
  AppearanceBrandColorOffsetConfig,
  AppearanceBrandConfig,
  AppearanceConfig,
  AppearanceThemeConfig,
  FeatureFlagsConfig,
  OpsConfigManifest,
  PublishedOpsConfig,
  SiteConfig,
} from './types';

function getBoundControlInitialValue(
  config: PublishedOpsConfig,
  controlId: 'text_type' | 'text_completeness' | 'evaluation_goal',
): string {
  const control = config.analysisControls.controls.find((item) => item.id === controlId && item.enabled);

  // 控件缺失时返回默认值，允许自由配置
  if (!control || !control.options[0]?.value) {
    const defaults: Record<string, string> = {
      text_type: 'general_text',
      text_completeness: 'complete',
      evaluation_goal: 'overall_check',
    };
    return defaults[controlId];
  }

  return control.options[0].value;
}

export function createInitialEvaluationInputFromConfig(config: PublishedOpsConfig): EvaluationInput {
  return createDefaultEvaluationInput({
    textType: getBoundControlInitialValue(config, 'text_type') as EvaluationInput['textType'],
    textCompleteness: getBoundControlInitialValue(config, 'text_completeness') as EvaluationInput['textCompleteness'],
    evaluationGoal: getBoundControlInitialValue(config, 'evaluation_goal') as EvaluationInput['evaluationGoal'],
  });
}
