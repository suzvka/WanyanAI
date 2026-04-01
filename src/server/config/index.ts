import 'server-only';

export { getPlatformConfig } from './loader';
export { createFallbackPlatformConfig } from './fallback';
export {
  validatePlatformConfig,
  validateSiteConfig,
  validateAnalysisControls,
  normalizeAnalysisControls,
} from './schemas';
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
  SiteConfig,
  PlatformManifest,
} from './types';
