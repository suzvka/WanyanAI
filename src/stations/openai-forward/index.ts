/**
 * OpenAI Forward 中转站
 *
 * 模型配置经 ConfigStore（基于数据库抽象 SqlDb）读写：
 * - 运行态：一律读 ConfigStore（key: station:openai-forward:models）
 * - 种子导入：store 无数据时，从 keys/*.json 导入一次并回写 store——
 *   keys/*.json 是历史文件渠道，仅作首次初始化种子，不再是运行态来源
 *   （消除对文件系统的直接读写，与 coze 站的启停配置统一走同一存储抽象）
 *
 * 转发：将请求转发到外部 OpenAI 兼容 API（仅依赖标准 fetch）。
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import type { Station, StationModel, ForwardRequest, AdminManagedStation, CredentialField, ModelToggle } from '../types';
import { createLogger, type Logger } from '../logger';
import { getConfigStore } from '../../config-store';
import { loadEnv } from 'yunzone-service-kit/config';
import { envSchema, envLoadOptions } from '../../lib/env-schema';

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

/** ConfigStore 中存储模型配置的键 */
const MODELS_STORE_KEY = 'station:openai-forward:models';

/**
 * 解析配置目录路径
 *
 * 优先级：注入的 configDir > WORKSPACE_PATH（中立键，平台注入旧名经适配层映射）> 当前工作目录
 */
let cachedWorkspacePath: string | undefined;
function getWorkspacePath(): string | undefined {
  if (cachedWorkspacePath === undefined) {
    cachedWorkspacePath = loadEnv(envSchema, envLoadOptions).WORKSPACE_PATH;
  }
  return cachedWorkspacePath;
}

function resolveConfigDir(configDir?: string): string {
  return configDir ?? getWorkspacePath() ?? process.cwd();
}

/**
 * 创建 OpenAI Forward 中转站
 *
 * @param options.configDir 配置根目录（默认使用 WORKSPACE_PATH 或 cwd；仅用于 keys/*.json 种子导入路径）
 * @param options.logger 日志实例（默认使用 console 实现）
 */
export function createOpenAIForwardStation(options?: { configDir?: string; logger?: Logger }): Station {
  const logger = options?.logger ?? createLogger('Station:OpenAI-Forward');
  const configDir = options?.configDir;

  /** 配置缓存（每个实例独立；null = 未加载） */
  let modelsCache: ModelConfig[] | null = null;

  /**
   * 解析 keys 目录路径（仅种子导入使用）
   */
  function resolveKeysDir(): string {
    return path.join(resolveConfigDir(configDir), 'keys');
  }

  /**
   * 从 keys 目录加载所有模型配置（种子源，仅首次导入时调用）
   */
  function loadModelsFromKeysDir(): ModelConfig[] {
    const keysDir = resolveKeysDir();

    if (!existsSync(keysDir)) {
      logger.info('keys 目录不存在，跳过种子导入', { keysDir });
      return [];
    }

    const models: ModelConfig[] = [];

    try {
      const files = readdirSync(keysDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      for (const file of jsonFiles) {
        const filePath = path.join(keysDir, file);

        try {
          const content = readFileSync(filePath, 'utf-8');
          const cfg = JSON.parse(content) as Partial<ModelConfig>;

          // 验证必要字段
          if (cfg.id && cfg.targetModel && cfg.targetBaseUrl) {
            models.push({
              id: cfg.id,
              targetModel: cfg.targetModel,
              minPermissionLevel: cfg.minPermissionLevel ?? 1,
              maxCallsPerHour: cfg.maxCallsPerHour ?? 1000,
              targetBaseUrl: cfg.targetBaseUrl,
              targetApiKey: cfg.targetApiKey ?? '',
              name: cfg.name,
              description: cfg.description,
            });
          } else {
            logger.warn(`模型配置缺少必要字段: ${file}`);
          }
        } catch (error) {
          logger.error(`加载模型配置失败: ${file}`, error);
        }
      }

      logger.info('keys/ 种子模型配置加载完成', { modelCount: models.length });
    } catch (error) {
      logger.error('读取 keys 目录失败', error);
    }

    return models;
  }

  /**
   * 加载模型配置（运行态唯一来源 = ConfigStore）
   * - store 有数据：直接使用
   * - store 无数据：从 keys/*.json 种子导入并回写 store（一次性）
   */
  async function loadModels(): Promise<ModelConfig[]> {
    if (modelsCache) {
      return modelsCache;
    }

    const store = getConfigStore();
    const raw = await store.get(MODELS_STORE_KEY);

    if (raw) {
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          modelsCache = parsed as ModelConfig[];
          logger.info('模型配置已从 ConfigStore 加载', { modelCount: modelsCache.length });
          return modelsCache;
        }
      } catch (error) {
        logger.error('ConfigStore 中的模型配置损坏，尝试种子导入', error);
      }
    }

    // 种子导入（仅首次）：keys/*.json → ConfigStore
    const seeded = loadModelsFromKeysDir();
    modelsCache = seeded;
    if (seeded.length > 0) {
      await store.set(MODELS_STORE_KEY, JSON.stringify(seeded));
      logger.info('已从 keys/ 导入模型配置到 ConfigStore', { modelCount: seeded.length });
    } else {
      logger.info('ConfigStore 无模型配置且无种子，模型列表为空');
    }

    return modelsCache;
  }

  /** 异步查找模型配置（forward / Admin 读取用） */
  async function getModelConfigAsync(modelId: string): Promise<ModelConfig | null> {
    const models = await loadModels();
    return models.find(m => m.id === modelId) || null;
  }

  /** 同步查找模型配置（canHandle 用；仅当缓存已就绪时有效） */
  function getCachedModelConfig(modelId: string): ModelConfig | null {
    return modelsCache?.find(m => m.id === modelId) ?? null;
  }

  /** 清空模型缓存，下次请求重新加载 */
  function clearModelsCache(): void {
    modelsCache = null;
    logger.info('模型缓存已清空');
  }

  return {
    id: 'openai-forward',
    name: 'OpenAI Forward',

    async getModels(): Promise<StationModel[]> {
      const models = await loadModels();
      return models.map(m => ({
        id: m.id,
        name: m.name,
        description: m.description,
        maxCallsPerHour: m.maxCallsPerHour,
        minPermissionLevel: m.minPermissionLevel,
      }));
    },

    canHandle(modelId: string): boolean {
      // 处理所有非 coze:// 前缀且已配置的模型（缓存由 getModels/forward 先行加载）
      const modelConfig = getCachedModelConfig(modelId);
      return modelConfig !== null && !modelId.startsWith('coze://');
    },

    async forward(request: ForwardRequest): Promise<Response> {
      const { model, messages, stream, headers, requestId, authKey, ...params } = request;

      // 确保模型配置已加载（缓存就绪，供同步查询）
      const modelConfig = await getModelConfigAsync(model);

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

      // 始终使用配置中的 key（ConfigStore 维护），用户的 UI key 仅用于本地权限解析
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
      const models = await loadModels();
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
      // 构造完整模型配置数组，全量写入 ConfigStore（不再操作 keys/*.json 文件系统）
      const configs: ModelConfig[] = fields.map(field => {
        const children = field.children ?? [];
        const getVal = (key: string): string => children.find(c => c.key === key)?.value ?? '';

        return {
          id: field.key,
          targetModel: getVal('targetModel'),
          targetBaseUrl: getVal('targetBaseUrl'),
          targetApiKey: getVal('targetApiKey'),
          name: getVal('name') || undefined,
          description: getVal('description') || undefined,
          minPermissionLevel: Number(getVal('minPermissionLevel')) || 1,
          maxCallsPerHour: Number(getVal('maxCallsPerHour')) || 1000,
        };
      });

      const store = getConfigStore();
      await store.set(MODELS_STORE_KEY, JSON.stringify(configs));
      clearModelsCache();
      logger.info('模型配置已更新（ConfigStore）', { modelCount: configs.length });
    },

    getModelToggles(): ModelToggle[] {
      return [];
    },

    async updateModelToggle(_modelId: string, _enabled: boolean): Promise<void> {
      // openai-forward 不支持模型启停开关
    },
  } as unknown as Station & AdminManagedStation;
}
