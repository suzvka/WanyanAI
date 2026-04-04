import fs from 'fs';
import path from 'path';

// ========== 类型定义 ==========

/**
 * 全局限流配置
 */
export interface GlobalRateLimitConfig {
  /** 每小时最大调用次数（该权限等级所有用户合计） */
  maxCallsPerHour: number;
}

/**
 * 用户级限流配置
 */
export interface PerUserRateLimitConfig {
  /** 每分钟最大调用次数 */
  maxCallsPerMinute: number;
  /** 每小时最大调用次数 */
  maxCallsPerHour: number;
}

/**
 * 单个权限等级的限流规则
 */
export interface RateLimitRule {
  /** 权限等级 */
  permissionLevel: number;
  /** 描述 */
  description?: string;
  /** 全局限流配置 */
  global: GlobalRateLimitConfig;
  /** 用户级限流配置 */
  perUser: PerUserRateLimitConfig;
}

/**
 * 默认行为配置
 */
export interface RateLimitDefaults {
  /** 未配置的权限等级处理方式：deny（拒绝）或 allow（允许） */
  unspecifiedLevel: 'deny' | 'allow';
}

/**
 * 限流配置文件结构
 */
export interface RateLimitConfig {
  version: string;
  rules: RateLimitRule[];
  defaults: RateLimitDefaults;
}

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

// 缓存配置
let cachedConfig: RateLimitConfig | null = null;
let configLastModified: number = 0;

/**
 * 获取配置文件路径
 */
function getConfigPath(): string {
  return path.join(
    process.env.COZE_WORKSPACE_PATH || '/workspace/projects',
    'ops-config',
    'rate-limit.json'
  );
}

/**
 * 加载限流配置（支持热更新）
 */
export function loadRateLimitConfig(): RateLimitConfig {
  const configPath = getConfigPath();

  try {
    // 检查文件是否存在
    if (!fs.existsSync(configPath)) {
      return DEFAULT_CONFIG;
    }

    const stats = fs.statSync(configPath);

    // 如果配置文件已修改，重新加载
    if (cachedConfig && stats.mtimeMs > configLastModified) {
      cachedConfig = null;
    }

    // 如果有缓存，直接返回
    if (cachedConfig) {
      return cachedConfig;
    }

    // 读取配置文件
    const configContent = fs.readFileSync(configPath, 'utf-8');
    const parsedConfig = JSON.parse(configContent) as RateLimitConfig;

    // 验证配置
    const validatedConfig = validateConfig(parsedConfig);
    
    cachedConfig = validatedConfig;
    configLastModified = stats.mtimeMs;

    return cachedConfig;
  } catch {
    return DEFAULT_CONFIG;
  }
}

/**
 * 强制重新加载配置
 */
export function reloadRateLimitConfig(): RateLimitConfig {
  cachedConfig = null;
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
