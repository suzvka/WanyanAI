/**
 * OpenAI Forward 中转站
 *
 * 从 keys/*.json 加载模型配置，将请求转发到外部 OpenAI 兼容 API。
 * 自包含实现：仅依赖标准 fetch，不依赖项目内部的服务/HTTP 封装。
 */

import { readFileSync, readdirSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import type { Station, StationModel, ForwardRequest, AdminManagedStation, CredentialField, ModelToggle } from '../types';
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

  /**
   * 清空模型缓存，下次请求重新加载
   */
  function clearModelsCache(): void {
    modelsCache = null;
    logger.info('模型缓存已清空');
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

    // ---- AdminManagedStation 实现 ----

    hasCredentialConfig: true,
    hasModelToggle: false,

    getCredentialSchema(): Promise<CredentialField[]> {
      return Promise.resolve([
        { key: 'id', label: '模型标识', type: 'text', required: true, description: '唯一标识，如 deepseek-chat' },
        { key: 'targetModel', label: '上游模型名', type: 'text', required: true, description: '转发到上游时的模型名称' },
        { key: 'targetBaseUrl', label: '上游地址', type: 'text', required: true, description: '上游 API 基础地址' },
        { key: 'targetApiKey', label: 'API Key', type: 'password', required: true, description: '上游 API 密钥' },
        { key: 'name', label: '显示名称', type: 'text', required: false, description: '前端展示的名称' },
        { key: 'description', label: '描述', type: 'text', required: false, description: '模型说明' },
        { key: 'minPermissionLevel', label: '最低权限等级', type: 'number', required: false, description: '默认为 1' },
        { key: 'maxCallsPerHour', label: '每小时调用上限', type: 'number', required: false, description: '默认为 1000' },
      ]);
    },

    async getCredentialConfig(): Promise<CredentialField[]> {
      const models = loadModelsFromKeysDir();
      return models.map(m => ({
        key: m.id,
        label: m.name || m.id,
        type: 'group',
        required: false,
        children: [
          { key: 'targetModel', label: '上游模型名', type: 'text', required: true, value: m.targetModel },
          { key: 'targetBaseUrl', label: '上游地址', type: 'text', required: true, value: m.targetBaseUrl },
          { key: 'targetApiKey', label: 'API Key', type: 'password', required: true, value: m.targetApiKey },
          { key: 'name', label: '显示名称', type: 'text', required: false, value: m.name ?? '' },
          { key: 'description', label: '描述', type: 'text', required: false, value: m.description ?? '' },
          { key: 'minPermissionLevel', label: '最低权限等级', type: 'number', required: false, value: String(m.minPermissionLevel) },
          { key: 'maxCallsPerHour', label: '每小时调用上限', type: 'number', required: false, value: String(m.maxCallsPerHour) },
        ],
      }));
    },

    async updateCredentialConfig(fields: CredentialField[]): Promise<void> {
      const keysDir = resolveKeysDir();

      // 确保目录存在
      if (!existsSync(keysDir)) {
        const { mkdirSync } = await import('node:fs');
        mkdirSync(keysDir, { recursive: true });
      }

      // 收集当前配置中所有模型 ID，用于清理已删除的配置
      const currentModelIds = new Set(fields.map(f => f.key));

      // 遍历已存在的 keys 文件，删除不在新配置中的
      const existingFiles = readdirSync(keysDir).filter(f => f.endsWith('.json'));
      for (const file of existingFiles) {
        const modelId = file.replace(/\.json$/, '');
        if (!currentModelIds.has(modelId)) {
          unlinkSync(path.join(keysDir, file));
          logger.info('删除已移除的模型配置', { modelId });
        }
      }

      // 写入新配置
      for (const field of fields) {
        const children = field.children ?? [];
        const getVal = (key: string): string => children.find(c => c.key === key)?.value ?? '';

        const modelId = field.key;
        const config: ModelConfig = {
          id: modelId,
          targetModel: getVal('targetModel'),
          targetBaseUrl: getVal('targetBaseUrl'),
          targetApiKey: getVal('targetApiKey'),
          name: getVal('name') || undefined,
          description: getVal('description') || undefined,
          minPermissionLevel: Number(getVal('minPermissionLevel')) || 1,
          maxCallsPerHour: Number(getVal('maxCallsPerHour')) || 1000,
        };

        const filePath = path.join(keysDir, `${modelId}.json`);
        writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf-8');
        logger.info('模型配置已更新', { modelId });
      }

      // 清空缓存，下次请求生效
      clearModelsCache();
    },

    getModelToggles(): ModelToggle[] {
      return [];
    },

    async updateModelToggle(_modelId: string, _enabled: boolean): Promise<void> {
      // openai-forward 不支持模型启停开关
    },
  } as unknown as Station & AdminManagedStation;
}

export default createOpenAIForwardStation;
