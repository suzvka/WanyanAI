/**
 * ConfigStore 工厂（依赖倒置：配置存储统一构建在数据库抽象 SqlDb 之上）
 *
 * 唯一事实来源 = DATABASE_PROVIDER（resolveDatabaseChannel 解析）：
 * - postgres / coze：kit 官方 PgSqlDb 适配（createSqlDb），连接凭证按渠道解析
 * - none（显式无库）：本地 json 文件模拟（FileSqlDb）——非回退，是渠道值域内
 *   的明确映射（"无需数据库时选非库存储后端"），与 kit 的 none fail-fast 语义对齐
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
import { SqlDbConfigStore } from './sql-db-store';
import { FileSqlDb } from './file-sql-db';
import { createSqlDb, resolveDatabaseChannel } from 'yunzone-service-kit/db';
import { createLogger } from '@/lib/api-station/logger';

const logger = createLogger('ConfigStore');

let instance: ConfigStore | null = null;

export function getConfigStore(): ConfigStore {
  if (instance) return instance;

  // 渠道唯一来源：DATABASE_PROVIDER（postgres / coze / none）
  const channel = resolveDatabaseChannel();

  if (channel === 'none') {
    // 显式无库 → 本地 json 文件模拟数据库行为（不创建任何数据库执行器）
    instance = new SqlDbConfigStore(new FileSqlDb());
    logger.info('ConfigStore 模式: 本地文件模拟（DATABASE_PROVIDER=none）');
  } else {
    // postgres / coze → kit 官方 PgSqlDb 适配（渠道差异 = 凭证获取方式）
    instance = new SqlDbConfigStore(createSqlDb({ channel }));
    logger.info('ConfigStore 模式: PostgreSQL', { channel });
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
