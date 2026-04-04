import fs from 'fs';
import path from 'path';

// 配置接口
interface ForwardConfig {
  version: string;
  challenge: {
    enabled: boolean;
    difficulty: number;
    tokenExpireMinutes: number;
    maxNonceAgeSeconds: number;
  };
  models: Array<{
    id: string;
    targetModel: string;
    minPermissionLevel: number;
    maxCallsPerHour: number;
    targetBaseUrl: string;
    targetApiKey: string;
  }>;
}

// 模型配置（完整的模型信息）
export interface ModelConfig {
    /** 模型ID，用户可见的名称 */
    id: string;
    /** 实际请求目标模型名称 */
    targetModel: string;
    /** 最小权限等级 */
    minPermissionLevel: number;
    /** 每小时最大调用次数 */
    maxCallsPerHour: number;
    /** 目标 API 基础 URL */
    targetBaseUrl: string;
    /** 目标 API Key */
    targetApiKey: string;
}

// 加载配置文件
let configCache: ForwardConfig | null = null;

function loadConfig(): ForwardConfig {
    if (configCache) {
        return configCache;
    }

    const configPath = path.join(process.cwd(), 'ops-config', 'forward.json');
    const configContent = fs.readFileSync(configPath, 'utf-8');
    configCache = JSON.parse(configContent) as ForwardConfig;
    return configCache;
}

// 根据模型 ID 获取模型配置
export function getModelConfig(modelId: string): ModelConfig | null {
    const config = loadConfig();
    return config.models.find(m => m.id === modelId) || null;
}

// 获取所有可用模型（根据权限等级过滤）
export function getAvailableModels(permissionLevel: number): ModelConfig[] {
    const config = loadConfig();
    return config.models.filter(m => m.minPermissionLevel <= permissionLevel);
}

// === 兼容旧接口 ===

// 转发映射接口
export interface ForwardMapping {
    /** 用户可见的模型ID */
    modelId: string;
    /** 实际请求的模型名称 */
    targetModel: string;
    /** 目标 API 基础 URL */
    targetBaseUrl: string;
    /** 目标 API Key */
    targetApiKey: string;
}

// 根据模型 ID 获取转发配置
export function getForwardMapping(modelId: string): ForwardMapping | null {
    const modelConfig = getModelConfig(modelId);
    if (!modelConfig) {
        return null;
    }
    return {
        modelId: modelConfig.id,
        targetModel: modelConfig.targetModel,
        targetBaseUrl: modelConfig.targetBaseUrl,
        targetApiKey: modelConfig.targetApiKey,
    };
}

// 获取所有转发映射
export function getAllForwardMappings(): ForwardMapping[] {
    const config = loadConfig();
    return config.models.map(m => ({
        modelId: m.id,
        targetModel: m.targetModel,
        targetBaseUrl: m.targetBaseUrl,
        targetApiKey: m.targetApiKey,
    }));
}

// 获取挑战配置
export function getChallengeConfig() {
    const config = loadConfig();
    return config.challenge;
}
