/**
 * ConfigStore 工厂函数
 *
 * 根据 CONFIG_STORE 环境变量选择实现：
 *   file       → FileConfigStore（默认）
 *   coze-db    → CozeDbConfigStore
 *   generic-db → GenericDbConfigStore（预留）
 *
 * 使用示例：
 * ```typescript
 * import { getConfigStore } from '@/config-store';
 * const store = getConfigStore();
 * await store.set('station:openai-forward:keys', JSON.stringify([...]));
 * const value = await store.get('station:openai-forward:keys');
 * ```
 */

import 'server-only';

import type { ConfigStore } from './types';
import { FileConfigStore } from './file-store';
import { createLogger } from '@/lib/api-station/logger';

const logger = createLogger('ConfigStore');

let instance: ConfigStore | null = null;

export function getConfigStore(): ConfigStore {
  if (instance) return instance;

  const mode = process.env.CONFIG_STORE || 'file';

  switch (mode) {
    case 'coze-db': {
      // 动态加载，避免在未安装 Supabase 依赖时报错
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { CozeDbConfigStore } = require('./coze-db-store');
      instance = new CozeDbConfigStore() as ConfigStore;
      logger.info('ConfigStore 模式: Coze 数据库', { mode });
      break;
    }
    case 'file':
    default: {
      instance = new FileConfigStore();
      logger.info('ConfigStore 模式: 本地文件', { mode });
      break;
    }
  }

  return instance;
}

/**
 * 重置 ConfigStore 实例（用于测试或配置变更后重新加载）
 */
export function resetConfigStore(): void {
  instance = null;
  logger.info('ConfigStore 实例已重置');
}

export type { ConfigStore } from './types';