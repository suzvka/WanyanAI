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
  /** 自定义字段（渲染器可声明需要哪些字段） */
  [key: string]: unknown;
};

export type AnalysisControlOptionInput = {
  value?: string;
  label: string;
  promptText?: string;
  enabled?: boolean;
  /** 自定义字段（渲染器可声明需要哪些字段） */
  [key: string]: unknown;
};

export type AnalysisControlConfig = {
  id: string;
  title: string;
  enabled: boolean;
  options: AnalysisControlOptionConfig[];
};

export type AnalysisControlInput = {
  id: string;
  title: string;
  enabled?: boolean;
  options: AnalysisControlOptionInput[];
};

export type AnalysisControlGroupConfig = {
  id: string;
  title: string;
  description?: string;
  enabled: boolean;
  controls: AnalysisControlConfig[];
};

export type AnalysisControlGroupInput = {
  id: string;
  title: string;
  description?: string;
  enabled?: boolean;
  controls: AnalysisControlInput[];
};

export type AnalysisControlsConfig = {
  groups: AnalysisControlGroupConfig[];
  controls: AnalysisControlConfig[];
};

export type AnalysisControlsInput = {
  groups?: AnalysisControlGroupInput[];
  controls?: AnalysisControlInput[];
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

/**
 * 平台版本信息
 */
export type PlatformManifest = {
  configVersion: string;
  publishedAt: string;
  publishedBy: string;
  environment: 'production' | 'staging' | 'local';
};

/**
 * 平台配置（已废弃，请使用 PlatformConfig from @/types/platform）
 * @deprecated 使用 PlatformConfig 替代
 */
export type PublishedOpsConfig = {
  source: 'published' | 'fallback';
  manifest: PlatformManifest;
  site: SiteConfig;
  featureFlags: FeatureFlagsConfig;
  analysisControls: AnalysisControlsConfig;
  appearance: AppearanceConfig;
};
