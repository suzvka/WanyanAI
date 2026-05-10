import {
  loadRateLimitConfig as loadUnifiedRateLimitConfig,
  type RateLimitConfig as UnifiedRateLimitConfig,
  type RateLimitDefaults as UnifiedRateLimitDefaults,
  type RateLimitRule as UnifiedRateLimitRule,
  type GlobalRateLimitConfig as UnifiedGlobalRateLimitConfig,
  type PerUserRateLimitConfig as UnifiedPerUserRateLimitConfig,
} from '@/server/platform-config';

// ========== 类型定义 ==========

/**
 * 全局限流配置
 */
export type GlobalRateLimitConfig = UnifiedGlobalRateLimitConfig;

/**
 * 用户级限流配置
 */
export type PerUserRateLimitConfig = UnifiedPerUserRateLimitConfig;

/**
 * 单个权限等级的限流规则
 */
export type RateLimitRule = UnifiedRateLimitRule;

/**
 * 默认行为配置
 */
export type RateLimitDefaults = UnifiedRateLimitDefaults;

/**
 * 限流配置文件结构
 */
export type RateLimitConfig = UnifiedRateLimitConfig;

// ========== 默认配置 ==========

const DEFAULT_RULES: RateLimitRule[] = [
  {
    permissionLevel: 1,
    description: '游客用户',
    global: {
      maxCallsPerHour: 1000,
    },
    perUser: {
      maxCallsPerMinute: 5,
      maxCallsPerHour: 50,
    },
  },
];

const DEFAULT_CONFIG: RateLimitConfig = {
  version: '1.0',
  rules: DEFAULT_RULES,
  defaults: {
    unspecifiedLevel: 'deny',
  },
};

// ========== 配置加载 ==========

/**
 * 加载限流配置（支持热更新）
 */
export function loadRateLimitConfig(): RateLimitConfig {
  try {
    return validateConfig(loadUnifiedRateLimitConfig());
  } catch {
    return DEFAULT_CONFIG;
  }
}

/**
 * 强制重新加载配置
 */
export function reloadRateLimitConfig(): RateLimitConfig {
  return loadRateLimitConfig();
}

/**
 * 验证配置有效性
 */
function validateConfig(config: RateLimitConfig): RateLimitConfig {
  // 确保 rules 是数组
  if (!Array.isArray(config.rules)) {
    config.rules = DEFAULT_RULES;
  }

  // 验证每个规则
  for (const rule of config.rules) {
    if (typeof rule.permissionLevel !== 'number' || rule.permissionLevel < 1) {
      rule.permissionLevel = 1;
    }

    if (!rule.global || typeof rule.global.maxCallsPerHour !== 'number') {
      rule.global = { maxCallsPerHour: 1000 };
    }

    if (!rule.perUser) {
      rule.perUser = { maxCallsPerMinute: 5, maxCallsPerHour: 50 };
    }

    if (typeof rule.perUser.maxCallsPerMinute !== 'number') {
      rule.perUser.maxCallsPerMinute = 5;
    }

    if (typeof rule.perUser.maxCallsPerHour !== 'number') {
      rule.perUser.maxCallsPerHour = 50;
    }
  }

  // 验证默认行为
  if (!config.defaults || !['deny', 'allow'].includes(config.defaults.unspecifiedLevel)) {
    config.defaults = { unspecifiedLevel: 'deny' };
  }

  return config;
}

/**
 * 根据权限等级获取限流规则
 * @param permissionLevel - 权限等级
 * @returns 限流规则，如果未配置则返回 null
 */
export function getRateLimitRule(permissionLevel: number): RateLimitRule | null {
  const config = loadRateLimitConfig();
  return config.rules.find(rule => rule.permissionLevel === permissionLevel) || null;
}

/**
 * 检查未配置等级的默认行为
 * @returns 是否允许未配置等级的请求
 */
export function isUnspecifiedLevelAllowed(): boolean {
  const config = loadRateLimitConfig();
  return config.defaults.unspecifiedLevel === 'allow';
}

/**
 * 获取所有已配置的权限等级
 */
export function getConfiguredPermissionLevels(): number[] {
  const config = loadRateLimitConfig();
  return config.rules.map(rule => rule.permissionLevel);
}
