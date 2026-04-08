import 'server-only';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { validatePlatformConfig, platformManifestSchema, appearanceSchema, featureFlagsSchema } from '@/server/config/schemas';
import type {
  ForwardChallengeConfig,
  ForwardConfig,
  ForwardModelConfig,
  PlatformConfig,
  RateLimitConfig,
  RateLimitDefaults,
  RateLimitRule,
} from './types';

const CONFIG_DIR_NAME = 'platform-config';
const KEYS_DIR_NAME = 'keys';

const DEFAULT_FORWARD_CHALLENGE: ForwardChallengeConfig = {
  enabled: false,
  difficulty: 3,
  tokenExpireMinutes: 30,
  maxNonceAgeSeconds: 300,
};

const DEFAULT_FORWARD_CONFIG: ForwardConfig = {
  version: '1.0',
  challenge: DEFAULT_FORWARD_CHALLENGE,
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

let forwardCache: { key: string; value: ForwardConfig } | null = null;
let rateLimitCache: { key: string; value: RateLimitConfig } | null = null;

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
        console.warn(`[loadForwardConfig] Failed to load key file: ${file}, error: ${error}`);
        continue;
      }
    }

    return models;
  } catch (error) {
    console.warn(`[loadForwardConfig] Failed to read keys directory: ${error}`);
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

function normalizeForwardConfig(config: Partial<ForwardConfig>): ForwardConfig {
  const models = Array.isArray(config.models)
    ? config.models
        .map((model) => normalizeForwardModel(model as Partial<ForwardModelConfig>))
        .filter((model): model is ForwardModelConfig => model !== null)
    : [];

  return {
    version: config.version || DEFAULT_FORWARD_CONFIG.version,
    challenge: {
      enabled: typeof config.challenge?.enabled === 'boolean' ? config.challenge.enabled : DEFAULT_FORWARD_CHALLENGE.enabled,
      difficulty: typeof config.challenge?.difficulty === 'number' ? config.challenge.difficulty : DEFAULT_FORWARD_CHALLENGE.difficulty,
      tokenExpireMinutes:
        typeof config.challenge?.tokenExpireMinutes === 'number'
          ? config.challenge.tokenExpireMinutes
          : DEFAULT_FORWARD_CHALLENGE.tokenExpireMinutes,
      maxNonceAgeSeconds:
        typeof config.challenge?.maxNonceAgeSeconds === 'number'
          ? config.challenge.maxNonceAgeSeconds
          : DEFAULT_FORWARD_CHALLENGE.maxNonceAgeSeconds,
    },
    models,
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
    // 从 forward.json 读取 challenge 配置
    const parsed = readPlatformJsonFileSync<Partial<ForwardConfig>>('forward.json');

    // 从 keys 目录自动发现所有模型配置
    const models = await loadModelConfigsFromKeysDir();

    const normalized: ForwardConfig = {
      version: parsed.version || DEFAULT_FORWARD_CONFIG.version,
      challenge: {
        enabled: typeof parsed.challenge?.enabled === 'boolean' ? parsed.challenge.enabled : DEFAULT_FORWARD_CHALLENGE.enabled,
        difficulty: typeof parsed.challenge?.difficulty === 'number' ? parsed.challenge.difficulty : DEFAULT_FORWARD_CHALLENGE.difficulty,
        tokenExpireMinutes:
          typeof parsed.challenge?.tokenExpireMinutes === 'number'
            ? parsed.challenge.tokenExpireMinutes
            : DEFAULT_FORWARD_CHALLENGE.tokenExpireMinutes,
        maxNonceAgeSeconds:
          typeof parsed.challenge?.maxNonceAgeSeconds === 'number'
            ? parsed.challenge.maxNonceAgeSeconds
            : DEFAULT_FORWARD_CHALLENGE.maxNonceAgeSeconds,
      },
      models,
    };

    forwardCache = { key: cacheKey, value: normalized };
    return normalized;
  } catch (error) {
    console.warn('[loadForwardConfig] Failed to load forward config, using defaults:', error);
    forwardCache = { key: cacheKey, value: DEFAULT_FORWARD_CONFIG };
    return DEFAULT_FORWARD_CONFIG;
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

export function clearPlatformConfigRuntimeCaches() {
  forwardCache = null;
  rateLimitCache = null;
}
