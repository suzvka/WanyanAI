import type { AppearanceConfig, FeatureFlagsConfig } from '@/server/config/types';
import type { PlatformConfig, PlatformManifest } from '@/types/platform';

export type { AppearanceConfig, FeatureFlagsConfig, PlatformConfig, PlatformManifest };

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

/**
 * 权限查询服务配置
 */
export type PermissionServiceConfig = {
  /** 权限查询服务地址（优先级高于环境变量） */
  url?: string;
  /** 探活检查间隔（毫秒），默认 30000 (30秒) */
  healthCheckIntervalMs?: number;
  /** 探活请求超时（毫秒），默认 3000 */
  healthCheckTimeoutMs?: number;
  /** 权限查询请求超时（毫秒），默认 5000 */
  verifyTimeoutMs?: number;
  /** 权限查询服务不可用时的默认权限等级，默认 1 (游客) */
  fallbackPermissionLevel?: number;
  /** 是否启用探活检查，默认 true */
  enableHealthCheck?: boolean;
};
