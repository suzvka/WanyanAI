/**
 * OpenAI Forward 中转站
 * 
 * 从 keys/*.json 加载模型配置，将请求转发到外部 OpenAI 兼容 API。
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import type { Station, StationModel, ForwardRequest } from '../types';
import { createLogger } from '@/lib/api-station/logger';
import { modelConfigProvider } from '@/services/modelConfig/provider';

const logger = createLogger('Station:OpenAI-Forward');

/**
 * 模型配置结构
 */
interface ModelConfig {
  id: string;
  targetModel: string;
  minPermissionLevel: number;
  maxCallsPerHour: number;
  targetBaseUrl: string;
  targetApiKey: string;
  name?: string;
  description?: string;
}

// 配置缓存
let modelsCache: ModelConfig[] | null = null;

/**
 * 解析配置目录路径
 */
function resolveConfigDir(): string {
  // 优先使用环境变量
  const configDir = process.env.COZE_WORKSPACE_PATH || process.cwd();
  return configDir;
}

/**
 * 解析 keys 目录路径
 */
function resolveKeysDir(): string {
  const configDir = resolveConfigDir();
  return path.join(configDir, 'keys');
}

/**
 * 从 keys 目录加载所有模型配置
 */
function loadModelsFromKeysDir(): ModelConfig[] {
  if (modelsCache) {
    return modelsCache;
  }

  const keysDir = resolveKeysDir();
  
  if (!existsSync(keysDir)) {
    logger.info('keys 目录不存在，返回空模型列表', { keysDir });
    modelsCache = [];
    return modelsCache;
  }

  const models: ModelConfig[] = [];

  try {
    const files = readdirSync(keysDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    for (const file of jsonFiles) {
      const filePath = path.join(keysDir, file);
      
      try {
        const content = readFileSync(filePath, 'utf-8');
        const config = JSON.parse(content);

        // 验证必要字段
        if (config.id && config.targetModel && config.targetBaseUrl) {
          models.push({
            id: config.id,
            targetModel: config.targetModel,
            minPermissionLevel: config.minPermissionLevel ?? 1,
            maxCallsPerHour: config.maxCallsPerHour ?? 1000,
            targetBaseUrl: config.targetBaseUrl,
            targetApiKey: config.targetApiKey ?? '',
            name: config.name,
            description: config.description,
          });
        } else {
          logger.warn(`模型配置缺少必要字段: ${file}`);
        }
      } catch (error) {
        logger.error(`加载模型配置失败: ${file}`, error);
      }
    }

    logger.info('模型配置加载完成', { modelCount: models.length });
    modelsCache = models;
  } catch (error) {
    logger.error('读取 keys 目录失败', error);
    modelsCache = [];
  }

  return modelsCache;
}

/**
 * 获取模型配置
 */
function getModelConfig(modelId: string): ModelConfig | null {
  const models = loadModelsFromKeysDir();
  return models.find(m => m.id === modelId) || null;
}

/**
 * OpenAI Forward 中转站实现
 */
export const openaiForwardStation: Station = {
  id: 'openai-forward',
  name: 'OpenAI Forward',

  getModels(): StationModel[] {
    const models = loadModelsFromKeysDir();
    return models.map(m => ({
      id: m.id,
      name: m.name,
      description: m.description,
      maxCallsPerHour: m.maxCallsPerHour,
    }));
  },

  canHandle(modelId: string): boolean {
    const modelConfig = getModelConfig(modelId);
    // 处理所有非 coze:// 前缀的模型
    return modelConfig !== null && !modelId.startsWith('coze://');
  },

  async forward(request: ForwardRequest): Promise<Response> {
    const { model, messages, stream, headers, requestId, authKey, ...params } = request;

    const modelConfig = getModelConfig(model);
    
    if (!modelConfig) {
      return new Response(
        JSON.stringify({
          error: {
            message: `Model not found: ${model}`,
            type: 'invalid_request_error',
            code: 'MODEL_NOT_FOUND',
            requestId,
          },
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 始终使用配置文件中的 key（keys/*.json），用户的 UI key 仅用于本地权限解析
    const apiKey = modelConfig.targetApiKey;

    logger.info('开始转发请求', {
      requestId,
      model,
      targetModel: modelConfig.targetModel,
      targetBaseUrl: modelConfig.targetBaseUrl,
      stream,
    });

    const result = await modelConfigProvider.chatCompletions(
      modelConfig.targetBaseUrl,
      apiKey,
      {
        model: modelConfig.targetModel,
        messages,
        stream,
        ...params,
      },
    );

    if (!result.success) {
      logger.error('转发请求失败', result.error, { requestId, model });
      return new Response(
        JSON.stringify({
          error: {
            message: result.error?.message || 'Forwarding failed',
            type: result.error?.code || 'forward_error',
            requestId,
          },
        }),
        { status: result.error?.status || 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    logger.info('转发请求成功', { requestId, model, stream });

    if (stream && result.response) {
      return new Response(result.response.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    const data = await result.response!.json();
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    });
  },
};

export default openaiForwardStation;
