export type FeatureFlagsConfig = {
  enableFileUpload: boolean;
  enableAnnotations: boolean;
};

export type AppearanceBrandConfig = {
  name: string;
  slogan?: string;
  fontFamily?: string;
};

export type AppearanceBackgroundOpacityConfig = {
  light: number;
  dark: number;
};

export type AppearanceBrandColorOffsetConfig = {
  light: number;
  dark: number;
};

export type AppearanceThemeConfig = {
  primary: string;
  backgroundOpacity: AppearanceBackgroundOpacityConfig;
  brandColorOffset: AppearanceBrandColorOffsetConfig;
};

export type AppearanceConfig = {
  brand: AppearanceBrandConfig;
  theme: AppearanceThemeConfig;
};

export type AnalysisControlOptionConfig = {
  value: string;
  label: string;
  promptText: string;
  enabled: boolean;
};

export type AnalysisControlConfig = {
  id: string;
  title: string;
  enabled: boolean;
  options: AnalysisControlOptionConfig[];
};

export type AnalysisControlGroupConfig = {
  id: string;
  title: string;
  description?: string;
  enabled: boolean;
  controls: AnalysisControlConfig[];
};

export type AnalysisControlsConfig = {
  groups: AnalysisControlGroupConfig[];
  controls: AnalysisControlConfig[];
};

export type AnalysisControlsInput = {
  groups?: AnalysisControlGroupConfig[];
  controls?: AnalysisControlConfig[];
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
  featureFlags: FeatureFlagsConfig;
  analysisControls: AnalysisControlsConfig;
  appearance: AppearanceConfig;
};
