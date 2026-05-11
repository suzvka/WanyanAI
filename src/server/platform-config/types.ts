import type { AppearanceConfig, FeatureFlagsConfig } from '@/server/config/types';
import type { PlatformConfig, PlatformManifest } from '@/types/platform';

export type { AppearanceConfig, FeatureFlagsConfig, PlatformConfig, PlatformManifest };

export type ForwardChallengeConfig = {
  enabled: boolean;
  difficulty: number;
  tokenExpireMinutes: number;
  maxNonceAgeSeconds: number;
};

export type ForwardModelConfig = {
  id: string;
  targetModel: string;
  minPermissionLevel: number;
  maxCallsPerHour: number;
  targetBaseUrl: string;
  targetApiKey: string;
  /** 显示名称（可选） */
  name?: string;
  /** 模型描述（可选） */
  description?: string;
};

export type ForwardConfig = {
  version: string;
  challenge: ForwardChallengeConfig;
  models: ForwardModelConfig[];
};

export type GlobalRateLimitConfig = {
  maxCallsPerHour: number;
};

export type PerUserRateLimitConfig = {
  maxCallsPerMinute: number;
  maxCallsPerHour: number;
};

export type RateLimitRule = {
  permissionLevel: number;
  description?: string;
  global: GlobalRateLimitConfig;
  perUser: PerUserRateLimitConfig;
};

export type RateLimitDefaults = {
  unspecifiedLevel: 'deny' | 'allow';
};

export type RateLimitConfig = {
  version: string;
  rules: RateLimitRule[];
  defaults: RateLimitDefaults;
};
