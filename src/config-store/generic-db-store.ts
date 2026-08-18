/**
 * GenericDbConfigStore
 *
 * 将配置写入通用 PostgreSQL runtime_config 表（Drizzle + node-postgres 直连）。
 * 适用于生产环境（部署包不可写）与任意可直连 Postgres 的部署形态。
 *
 * 连接串来源：DATABASE_PROVIDER 分派的 resolveDatabaseUrl()——
 *   postgres（默认）→ DATABASE_URL；coze → Coze 平台 PG* 变量组。
 * 表结构定义见 src/storage/database/shared/schema.ts（runtimeConfig）。
 */

import 'server-only';

import { asc, eq, like } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { resolveDatabaseUrl } from 'yunzone-service-kit/config';

import type { ConfigStore } from './types';
import { runtimeConfig } from '@/storage/database/shared/schema';
import { createLogger } from '@/lib/api-station/logger';

const logger = createLogger('ConfigStore:Db');

/** 连接池单例挂在 globalThis，避免热重载重复建池（复用用户中心 raw.ts 模式） */
const globalForPool = globalThis as unknown as { __configStorePool?: Pool };

function getPool(): Pool {
  if (!globalForPool.__configStorePool) {
    globalForPool.__configStorePool = new Pool({
      connectionString: resolveDatabaseUrl(),
      max: 5,
    });
  }
  return globalForPool.__configStorePool;
}

function getDb(): NodePgDatabase {
  return drizzle(getPool());
}

export class GenericDbConfigStore implements ConfigStore {
  async get(key: string): Promise<string | null> {
    try {
      const db = getDb();
      const rows = await db
        .select({ value: runtimeConfig.value })
        .from(runtimeConfig)
        .where(eq(runtimeConfig.key, key))
        .limit(1);
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

      const db = getDb();
      const now = new Date();
      await db
        .insert(runtimeConfig)
        .values({ key, value: parsedValue, updatedAt: now })
        .onConflictDoUpdate({
          target: runtimeConfig.key,
          set: { value: parsedValue, updatedAt: now },
        });

      logger.info('配置已写入数据库', { key });
    } catch (error) {
      logger.error('GenericDbConfigStore.set 失败', error, { key });
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const db = getDb();
      await db.delete(runtimeConfig).where(eq(runtimeConfig.key, key));
      logger.info('配置已从数据库删除', { key });
    } catch (error) {
      logger.error('GenericDbConfigStore.delete 失败', error, { key });
    }
  }

  async list(prefix: string): Promise<{ key: string; value: string }[]> {
    try {
      const db = getDb();
      const rows = await db
        .select({ key: runtimeConfig.key, value: runtimeConfig.value })
        .from(runtimeConfig)
        .where(like(runtimeConfig.key, `${prefix}%`))
        .orderBy(asc(runtimeConfig.key));
      return rows.map((row) => ({ key: row.key, value: JSON.stringify(row.value) }));
    } catch (error) {
      logger.error('数据库查询失败', error, { prefix });
      return [];
    }
  }
}