/**
 * GenericDbConfigStore
 *
 * 将配置写入通用 PostgreSQL runtime_config 表（SqlDb 契约 + PgSqlDb 渠道适配器）。
 * 适用于生产环境（部署包不可写）与任意可直连 Postgres 的部署形态。
 *
 * 连接串来源：DATABASE_PROVIDER 分派的 resolveDatabaseUrl()——
 *   postgres（默认）→ DATABASE_URL；coze → Coze 平台 PG* 变量组。
 * 表结构 DDL 见 scripts/db-setup.sql（runtime_config）。
 */

import 'server-only';

import { PgSqlDb } from 'yunzone-service-kit/db';
import type { SqlDb } from 'yunzone-service-kit/db';
import { resolveDatabaseUrl } from 'yunzone-service-kit/config';

import type { ConfigStore } from './types';
import { createLogger } from '@/lib/api-station/logger';

const logger = createLogger('ConfigStore:Db');

/** 执行器单例挂在 globalThis，避免热重载重复建池（复用用户中心 raw.ts 模式） */
const globalForDb = globalThis as unknown as { __configStoreDb?: SqlDb };

function getDb(): SqlDb {
  if (!globalForDb.__configStoreDb) {
    globalForDb.__configStoreDb = new PgSqlDb(resolveDatabaseUrl(), { max: 5 });
  }
  return globalForDb.__configStoreDb;
}

export class GenericDbConfigStore implements ConfigStore {
  async get(key: string): Promise<string | null> {
    try {
      const rows = await getDb().query<{ value: unknown }>(
        'SELECT value FROM runtime_config WHERE key = $1',
        [key]
      );
      if (rows.length === 0) return null;
      return JSON.stringify(rows[0].value);
    } catch (error) {
      logger.error('数据库读取失败', error, { key });
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    try {
      let parsedValue: unknown;
      try {
        parsedValue = JSON.parse(value);
      } catch {
        parsedValue = value;
      }

      const now = new Date();
      await getDb().execute(
        `INSERT INTO runtime_config (key, value, updated_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
        [key, parsedValue, now]
      );

      logger.info('配置已写入数据库', { key });
    } catch (error) {
      logger.error('GenericDbConfigStore.set 失败', error, { key });
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await getDb().execute('DELETE FROM runtime_config WHERE key = $1', [key]);
      logger.info('配置已从数据库删除', { key });
    } catch (error) {
      logger.error('GenericDbConfigStore.delete 失败', error, { key });
    }
  }

  async list(prefix: string): Promise<{ key: string; value: string }[]> {
    try {
      const rows = await getDb().query<{ key: string; value: unknown }>(
        'SELECT key, value FROM runtime_config WHERE key LIKE $1 ORDER BY key',
        [`${prefix}%`]
      );
      return rows.map((row) => ({ key: row.key, value: JSON.stringify(row.value) }));
    } catch (error) {
      logger.error('数据库查询失败', error, { prefix });
      return [];
    }
  }
}
