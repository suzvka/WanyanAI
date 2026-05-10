import { loadForwardConfig, type ForwardChallengeConfig, type ForwardConfig, type ForwardModelConfig } from '@/server/platform-config';

// 模型配置（完整的模型信息）
export type ModelConfig = ForwardModelConfig;

async function loadConfig(): Promise<ForwardConfig> {
    return await loadForwardConfig();
}

// 根据模型 ID 获取模型配置
export async function getModelConfig(modelId: string): Promise<ModelConfig | null> {
    const config = await loadConfig();
    return config.models.find(m => m.id === modelId) || null;
}

// 获取所有可用模型（根据权限等级过滤）
export async function getAvailableModels(permissionLevel: number): Promise<ModelConfig[]> {
    const config = await loadConfig();
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
export async function getForwardMapping(modelId: string): Promise<ForwardMapping | null> {
    const modelConfig = await getModelConfig(modelId);
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
export async function getAllForwardMappings(): Promise<ForwardMapping[]> {
    const config = await loadConfig();
    return config.models.map(m => ({
        modelId: m.id,
        targetModel: m.targetModel,
        targetBaseUrl: m.targetBaseUrl,
        targetApiKey: m.targetApiKey,
    }));
}

// 获取挑战配置
export async function getChallengeConfig(): Promise<ForwardChallengeConfig> {
    const config = await loadConfig();
    return config.challenge;
}
