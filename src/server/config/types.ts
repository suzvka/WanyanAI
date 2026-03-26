import {
  EvaluationGoal,
  TextCompleteness,
  TextType,
} from '@/types/report';

export type CatalogOption<T extends string> = {
  value: T;
  label: string;
  description: string;
  enabled: boolean;
  sortOrder: number;
  badge?: string;
  recommended?: boolean;
};

export type EvaluationCatalogConfig = {
  textTypes: CatalogOption<TextType>[];
  textCompletenessOptions: CatalogOption<TextCompleteness>[];
  evaluationGoals: CatalogOption<EvaluationGoal>[];
};

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
    modelHint: string;
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
  errors: {
    generic: string;
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
  catalog: EvaluationCatalogConfig;
  defaults: EvaluationDefaultsConfig;
  featureFlags: FeatureFlagsConfig;
  analysisControls: AnalysisControlsConfig;
};
