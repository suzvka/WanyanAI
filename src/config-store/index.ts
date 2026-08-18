/**
 * ConfigStore 工厂函数
 *
 * 根据 CONFIG_STORE 环境变量选择实现：
 *   file → FileConfigStore（默认）
 *   db   → GenericDbConfigStore（通用 PostgreSQL，DATABASE_PROVIDER 分派连接串）
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
    case 'db': {
      // 动态加载，避免连接池在未启用 db 模式时初始化
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { GenericDbConfigStore } = require('./generic-db-store');
      instance = new GenericDbConfigStore() as ConfigStore;
      logger.info('ConfigStore 模式: PostgreSQL', { mode });
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