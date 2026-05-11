import 'server-only';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { validatePlatformConfig, platformManifestSchema, appearanceSchema, featureFlagsSchema } from '@/server/config/schemas';
import { createLogger } from '@/lib/api-station/logger';
import type {
  AuthServiceConfig,
  ForwardConfig,
  ForwardModelConfig,
  PlatformConfig,
  RateLimitConfig,
  RateLimitDefaults,
  RateLimitRule,
} from './types';

const logger = createLogger('platform-config');

const CONFIG_DIR_NAME = 'platform-config';
const KEYS_DIR_NAME = 'keys';

const DEFAULT_FORWARD_CONFIG: ForwardConfig = {
  version: '1.0',
  models: [],
};

const DEFAULT_RATE_LIMIT_RULES: RateLimitRule[] = [
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

const DEFAULT_RATE_LIMIT_DEFAULTS: RateLimitDefaults = {
  unspecifiedLevel: 'deny',
};

const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  version: '1.0',
  rules: DEFAULT_RATE_LIMIT_RULES,
  defaults: DEFAULT_RATE_LIMIT_DEFAULTS,
};

const DEFAULT_AUTH_SERVICE_CONFIG: AuthServiceConfig = {
  url: undefined,
  healthCheckIntervalMs: 30000,
  healthCheckTimeoutMs: 3000,
  verifyTimeoutMs: 5000,
  fallbackPermissionLevel: 1,
  enableHealthCheck: true,
};

let forwardCache: { key: string; value: ForwardConfig } | null = null;
let rateLimitCache: { key: string; value: RateLimitConfig } | null = null;
let authServiceCache: { key: string; value: AuthServiceConfig } | null = null;

function getConfigRoot(): string {
  return process.cwd();
}

function resolveConfigDirSync(): string {
  const configDir = path.join(getConfigRoot(), CONFIG_DIR_NAME);
  return existsSync(configDir) ? configDir : configDir;
}

/**
 * 解析 keys 目录路径
 */
function resolveKeysDirSync(): string {
  const keysDir = path.join(getConfigRoot(), KEYS_DIR_NAME);
  return keysDir;
}

async function resolveConfigDir(): Promise<string> {
  return resolveConfigDirSync();
}

function createFileCacheKey(filePath: string): string {
  try {
    const stats = statSync(filePath);
    return `${filePath}:${stats.mtimeMs}`;
  } catch {
    return `${filePath}:missing`;
  }
}

async function readPlatformJsonFile<T>(fileName: string): Promise<T> {
  const configDir = await resolveConfigDir();
  const content = await readFile(path.join(configDir, fileName), 'utf-8');
  return JSON.parse(content) as T;
}

function readPlatformJsonFileSync<T>(fileName: string): T {
  const configDir = resolveConfigDirSync();
  const content = readFileSync(path.join(configDir, fileName), 'utf-8');
  return JSON.parse(content) as T;
}

/**
 * 从 keys 目录加载所有模型配置
 * 自动发现所有 .json 文件，解析错误时跳过
 */
async function loadModelConfigsFromKeysDir(): Promise<ForwardModelConfig[]> {
  const keysDir = resolveKeysDirSync();

  // 如果 keys 目录不存在，返回空数组
  if (!existsSync(keysDir)) {
    return [];
  }

  try {
    const files = await readdir(keysDir);
    const jsonFiles = files.filter(file => file.endsWith('.json'));

    const models: ForwardModelConfig[] = [];

    for (const file of jsonFiles) {
      const filePath = path.join(keysDir, file);
      try {
        const content = await readFile(filePath, 'utf-8');
        const parsed = JSON.parse(content) as Partial<ForwardModelConfig>;
        const normalized = normalizeForwardModel(parsed);

        if (normalized) {
          models.push(normalized);
        }
      } catch (error) {
        // 文件解析错误时跳过，不影响其他文件
        logger.warn('Failed to load key file', { file, error: String(error) });
        continue;
      }
    }

    return models;
  } catch (error) {
    logger.warn('Failed to read keys directory', { error: String(error) });
    return [];
  }
}

function normalizeForwardModel(model: Partial<ForwardModelConfig>): ForwardModelConfig | null {
  if (!model.id || !model.targetModel || !model.targetBaseUrl || !model.targetApiKey) {
    return null;
  }

  return {
    id: model.id,
    targetModel: model.targetModel,
    minPermissionLevel: typeof model.minPermissionLevel === 'number' && model.minPermissionLevel > 0 ? model.minPermissionLevel : 1,
    maxCallsPerHour: typeof model.maxCallsPerHour === 'number' && model.maxCallsPerHour > 0 ? model.maxCallsPerHour : 1000,
    targetBaseUrl: model.targetBaseUrl,
    targetApiKey: model.targetApiKey,
  };
}

function normalizeRateLimitRule(rule: Partial<RateLimitRule>): RateLimitRule {
  return {
    permissionLevel: typeof rule.permissionLevel === 'number' && rule.permissionLevel > 0 ? rule.permissionLevel : 1,
    description: rule.description,
    global: {
      maxCallsPerHour:
        typeof rule.global?.maxCallsPerHour === 'number' && rule.global.maxCallsPerHour > 0
          ? rule.global.maxCallsPerHour
          : 1000,
    },
    perUser: {
      maxCallsPerMinute:
        typeof rule.perUser?.maxCallsPerMinute === 'number' && rule.perUser.maxCallsPerMinute > 0
          ? rule.perUser.maxCallsPerMinute
          : 5,
      maxCallsPerHour:
        typeof rule.perUser?.maxCallsPerHour === 'number' && rule.perUser.maxCallsPerHour > 0
          ? rule.perUser.maxCallsPerHour
          : 50,
    },
  };
}

function normalizeRateLimitConfig(config: Partial<RateLimitConfig>): RateLimitConfig {
  return {
    version: config.version || DEFAULT_RATE_LIMIT_CONFIG.version,
    rules: Array.isArray(config.rules) && config.rules.length > 0
      ? config.rules.map((rule) => normalizeRateLimitRule(rule as Partial<RateLimitRule>))
      : DEFAULT_RATE_LIMIT_RULES,
    defaults: {
      unspecifiedLevel:
        config.defaults?.unspecifiedLevel === 'allow' || config.defaults?.unspecifiedLevel === 'deny'
          ? config.defaults.unspecifiedLevel
          : DEFAULT_RATE_LIMIT_DEFAULTS.unspecifiedLevel,
    },
  };
}

export async function loadPublishedPlatformConfig(): Promise<PlatformConfig> {
  const [manifest, appearance, featureFlags] = await Promise.all([
    readPlatformJsonFile('manifest.json'),
    readPlatformJsonFile('appearance.json'),
    readPlatformJsonFile('feature-flags.json'),
  ]);

  return validatePlatformConfig({
    manifest: platformManifestSchema.parse(manifest),
    appearance: appearanceSchema.parse(appearance),
    featureFlags: featureFlagsSchema.parse(featureFlags),
  });
}

export async function loadForwardConfig(): Promise<ForwardConfig> {
  const configDir = resolveConfigDirSync();
  const filePath = path.join(configDir, 'forward.json');
  const keysDir = resolveKeysDirSync();
  const cacheKey = `${createFileCacheKey(filePath)}:${createFileCacheKey(keysDir)}`;

  if (forwardCache?.key === cacheKey) {
    return forwardCache.value;
  }

  try {
    // 从 forward.json 读取版本配置
    const parsed = readPlatformJsonFileSync<Partial<ForwardConfig>>('forward.json');

    // 从 keys 目录自动发现所有模型配置
    const models = await loadModelConfigsFromKeysDir();

    const normalized: ForwardConfig = {
      version: parsed.version || DEFAULT_FORWARD_CONFIG.version,
      models,
    };

    forwardCache = { key: cacheKey, value: normalized };
    return normalized;
  } catch (error) {
    logger.warn('Failed to load forward config, using defaults', { error: String(error) });

    const fallbackConfig: ForwardConfig = {
      ...DEFAULT_FORWARD_CONFIG,
      models: [],
    };

    forwardCache = { key: cacheKey, value: fallbackConfig };
    return fallbackConfig;
  }
}

export function loadRateLimitConfig(): RateLimitConfig {
  const configDir = resolveConfigDirSync();
  const filePath = path.join(configDir, 'rate-limit.json');
  const cacheKey = createFileCacheKey(filePath);

  if (rateLimitCache?.key === cacheKey) {
    return rateLimitCache.value;
  }

  try {
    const parsed = readPlatformJsonFileSync<Partial<RateLimitConfig>>('rate-limit.json');
    const normalized = normalizeRateLimitConfig(parsed);
    rateLimitCache = { key: cacheKey, value: normalized };
    return normalized;
  } catch {
    rateLimitCache = { key: cacheKey, value: DEFAULT_RATE_LIMIT_CONFIG };
    return DEFAULT_RATE_LIMIT_CONFIG;
  }
}

/**
 * 加载认证服务配置
 */
export function loadAuthServiceConfig(): AuthServiceConfig {
  const configDir = resolveConfigDirSync();
  const filePath = path.join(configDir, 'auth-service.json');
  const cacheKey = createFileCacheKey(filePath);

  if (authServiceCache?.key === cacheKey) {
    return authServiceCache.value;
  }

  try {
    const parsed = readPlatformJsonFileSync<Partial<AuthServiceConfig>>('auth-service.json');
    const normalized: AuthServiceConfig = {
      url: parsed.url || process.env.AUTH_SERVICE_URL || process.env.ACCOUNT_SERVICE_URL || undefined,
      healthCheckIntervalMs: parsed.healthCheckIntervalMs ?? DEFAULT_AUTH_SERVICE_CONFIG.healthCheckIntervalMs,
      healthCheckTimeoutMs: parsed.healthCheckTimeoutMs ?? DEFAULT_AUTH_SERVICE_CONFIG.healthCheckTimeoutMs,
      verifyTimeoutMs: parsed.verifyTimeoutMs ?? DEFAULT_AUTH_SERVICE_CONFIG.verifyTimeoutMs,
      fallbackPermissionLevel: parsed.fallbackPermissionLevel ?? DEFAULT_AUTH_SERVICE_CONFIG.fallbackPermissionLevel,
      enableHealthCheck: parsed.enableHealthCheck ?? DEFAULT_AUTH_SERVICE_CONFIG.enableHealthCheck,
    };
    authServiceCache = { key: cacheKey, value: normalized };
    return normalized;
  } catch {
    // 文件不存在或解析失败时使用默认值
    const fallback: AuthServiceConfig = {
      ...DEFAULT_AUTH_SERVICE_CONFIG,
      url: process.env.AUTH_SERVICE_URL || process.env.ACCOUNT_SERVICE_URL || undefined,
    };
    authServiceCache = { key: cacheKey, value: fallback };
    return fallback;
  }
}

export function clearPlatformConfigRuntimeCaches() {
  forwardCache = null;
  rateLimitCache = null;
  authServiceCache = null;
}
