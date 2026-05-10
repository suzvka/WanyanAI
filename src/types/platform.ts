import type { AppearanceConfig, FeatureFlagsConfig } from '@/server/config/types';

/**
 * 平台版本信息
 */
export type PlatformManifest = {
  /** 配置版本 */
  configVersion: string;
  /** 发布时间 */
  publishedAt: string;
  /** 发布者 */
  publishedBy: string;
  /** 运行环境 */
  environment: 'production' | 'staging' | 'local';
};

/**
 * 平台配置
 */
export type PlatformConfig = {
  /** 配置来源 */
  source: 'published' | 'fallback';
  /** 平台版本信息 */
  manifest: PlatformManifest;
  /** 外观配置 */
  appearance: AppearanceConfig;
  /** 功能开关 */
  featureFlags: FeatureFlagsConfig;
};
