/**
 * OpenAI Forward 中转站
 *
 * 从 keys/*.json 加载模型配置，将请求转发到外部 OpenAI 兼容 API。
 * 自包含实现：仅依赖标准 fetch，不依赖项目内部的服务/HTTP 封装。
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import type { Station, StationModel, ForwardRequest } from '../types';
import { createLogger, type Logger } from '../logger';

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

/**
 * 解析配置目录路径
 *
 * 优先级：注入的 configDir > COZE_WORKSPACE_PATH 环境变量 > 当前工作目录
 */
function resolveConfigDir(configDir?: string): string {
  return configDir ?? process.env.COZE_WORKSPACE_PATH ?? process.cwd();
}

/**
 * 创建 OpenAI Forward 中转站
 *
 * @param options.configDir 配置根目录（默认使用 COZE_WORKSPACE_PATH 或 cwd）
 * @param options.logger 日志实例（默认使用 console 实现）
 */
export function createOpenAIForwardStation(options?: { configDir?: string; logger?: Logger }): Station {
  const logger = options?.logger ?? createLogger('Station:OpenAI-Forward');
  const configDir = options?.configDir;

  /** 配置缓存（每个实例独立） */
  let modelsCache: ModelConfig[] | null = null;

  /**
   * 解析 keys 目录路径
   */
  function resolveKeysDir(): string {
    return path.join(resolveConfigDir(configDir), 'keys');
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

  return {
    id: 'openai-forward',
    name: 'OpenAI Forward',

    getModels(): StationModel[] {
      const models = loadModelsFromKeysDir();
      return models.map(m => ({
        id: m.id,
        name: m.name,
        description: m.description,
        maxCallsPerHour: m.maxCallsPerHour,
        minPermissionLevel: m.minPermissionLevel,
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

      try {
        const response = await fetch(`${modelConfig.targetBaseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: modelConfig.targetModel,
            messages,
            stream,
            ...params,
          }),
        });

        if (!response.ok) {
          // 提取上游错误消息（优先响应体中的 error.message）
          let upstreamMessage: string | undefined;
          try {
            const data = (await response.json()) as {
              error?: { message?: string };
              message?: string;
            };
            upstreamMessage = data?.error?.message ?? data?.message;
          } catch {
            // 响应体非 JSON 时忽略
          }

          logger.error('转发请求失败', undefined, {
            requestId,
            model,
            status: response.status,
          });

          return new Response(
            JSON.stringify({
              error: {
                message: upstreamMessage || `Upstream request failed (${response.status})`,
                type: 'upstream_error',
                code: 'UPSTREAM_ERROR',
                requestId,
              },
            }),
            { status: response.status, headers: { 'Content-Type': 'application/json' } }
          );
        }

        logger.info('转发请求成功', { requestId, model, stream });

        if (stream) {
          return new Response(response.body, {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
            },
          });
        }

        const data = await response.json();
        return new Response(JSON.stringify(data), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        logger.error('转发请求失败', error, { requestId, model });

        return new Response(
          JSON.stringify({
            error: {
              message: error instanceof Error ? error.message : 'Forwarding failed',
              type: 'forward_error',
              code: 'FORWARD_ERROR',
              requestId,
            },
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    },
  };
}

export default createOpenAIForwardStation;
