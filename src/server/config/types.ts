import {
  EvaluationGoal,
  TextCompleteness,
  TextType,
} from '@/types/report';

export type EvaluationDefaultsConfig = {
  textType: TextType;
  textCompleteness: TextCompleteness;
  evaluationGoal: EvaluationGoal;
};

export type FeatureFlagsConfig = {
  enableFileUpload: boolean;
  enableAnnotations: boolean;
};

export type AnalysisControlOptionConfig = {
  value: string;
  label: string;
  promptText: string;
  enabled: boolean;
};

export type AnalysisControlBinding = 'textType' | 'textCompleteness' | 'evaluationGoal';

export type AnalysisControlConfig = {
  id: string;
  title: string;
  enabled: boolean;
  sortOrder: number;
  bindTo?: AnalysisControlBinding;
  appliesTo: EvaluationGoal[];
  options: AnalysisControlOptionConfig[];
};

export type AnalysisControlsConfig = {
  controls: AnalysisControlConfig[];
};

export type SiteConfig = {
  home: {
    title: string;
    subtitle: string;
  };
  inputPanel: {
    title: string;
    description: string;
  };
  settingsPanel: {
    title: string;
    description: string;
  };
  progress: {
    runningTitle: string;
    runningDescription: string;
  };
};

export type OpsConfigManifest = {
  configVersion: string;
  publishedAt: string;
  publishedBy: string;
  environment: 'production' | 'staging' | 'local';
};

export type PublishedOpsConfig = {
  source: 'published' | 'fallback';
  manifest: OpsConfigManifest;
  site: SiteConfig;
  defaults: EvaluationDefaultsConfig;
  featureFlags: FeatureFlagsConfig;
  analysisControls: AnalysisControlsConfig;
};
