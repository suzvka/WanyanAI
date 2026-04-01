import fs from 'fs';
import path from 'path';

// 模型配置（完整的模型信息）
export interface ModelConfig {
  id: string;
  displayName: string;
  minPermissionLevel: number;
  maxCallsPerHour: number;
  targetBaseUrl: string;
  targetApiKey: string;
}

// 限流配置
export interface RateLimitConfig {
  globalMaxCallsPerMinute: number;
  browserMaxCallsPerHour: number;
}

// 转发配置文件结构（唯一配置源）
export interface ForwardConfig {
  version: string;
  rateLimit: RateLimitConfig;
  models: ModelConfig[];
}

// 缓存配置
let cachedConfig: ForwardConfig | null = null;
let configLastModified: number = 0;

// 获取配置文件路径
function getConfigPath(): string {
  return path.join(process.env.COZE_WORKSPACE_PATH || '/workspace/projects', 'ops-config', 'forward.json');
}

// 加载配置（支持热更新）
export function loadConfig(): ForwardConfig {
  const configPath = getConfigPath();

  try {
    // 检查文件是否存在
    if (!fs.existsSync(configPath)) {
      return {
        version: '1.0',
        rateLimit: {
          globalMaxCallsPerMinute: 1000,
          browserMaxCallsPerHour: 10,
        },
        models: [],
      };
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
    cachedConfig = JSON.parse(configContent) as ForwardConfig;
    configLastModified = stats.mtimeMs;

    return cachedConfig;
  } catch {
    return {
      version: '1.0',
      rateLimit: {
        globalMaxCallsPerMinute: 1000,
        browserMaxCallsPerHour: 10,
      },
      models: [],
    };
  }
}

// 强制重新加载配置（用于手动刷新）
export function reloadConfig(): ForwardConfig {
  cachedConfig = null;
  return loadConfig();
}

// 根据模型 ID 获取模型配置
export function getModelConfig(modelId: string): ModelConfig | undefined {
  const config = loadConfig();
  return config.models.find(m => m.id === modelId);
}

// 根据权限等级过滤可用模型
export function getAvailableModels(permissionLevel: number): ModelConfig[] {
  const config = loadConfig();
  return config.models.filter(m => m.minPermissionLevel <= permissionLevel);
}

// 获取所有模型 ID 列表
export function getModelIds(): string[] {
  const config = loadConfig();
  return config.models.map(m => m.id);
}

// 获取限流配置
export function getRateLimitConfig(): RateLimitConfig {
  const config = loadConfig();
  return config.rateLimit;
}

// === 兼容旧接口 ===

// 转发映射接口（向后兼容）
export interface ForwardMapping {
  modelId: string;
  sourceModel: string;
  targetBaseUrl: string;
  targetApiKey: string;
}

// 根据模型 ID 获取转发配置（向后兼容）
export function getForwardMapping(modelId: string): ForwardMapping | null {
  const modelConfig = getModelConfig(modelId);
  if (!modelConfig) {
    return null;
  }
  return {
    modelId: modelConfig.id,
    sourceModel: modelConfig.id,
    targetBaseUrl: modelConfig.targetBaseUrl,
    targetApiKey: modelConfig.targetApiKey,
  };
}

// 获取所有转发映射（向后兼容）
export function getAllForwardMappings(): ForwardMapping[] {
  const config = loadConfig();
  return config.models.map(m => ({
    modelId: m.id,
    sourceModel: m.id,
    targetBaseUrl: m.targetBaseUrl,
    targetApiKey: m.targetApiKey,
  }));
}

// 获取所有已配置转发的模型 ID 列表（向后兼容）
export function getForwardableModelIds(): string[] {
  return getModelIds();
}
