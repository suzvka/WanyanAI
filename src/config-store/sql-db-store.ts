/**
 * SqlDbConfigStore — 基于数据库抽象（SqlDb）的运行时配置 KV 视图
 *
 * 定位（依赖倒置）：
 * 本类不感知数据库底层实现——SqlDb 由组合根（config-store 工厂）注入，
 * 可以是 PgSqlDb（postgres / coze 渠道）或 FileSqlDb（本地 json 文件模拟）。
 * 配置存储统一构建在 SqlDb 抽象之上，不存在独立的 file/db 双轨实现。
 *
 * 表结构：runtime_config（key/value/updated_at，见 scripts/db-setup.sql）
 */

import 'server-only';

import type { SqlDb } from 'yunzone-service-kit/db';
import type { ConfigStore } from './types';
import { createLogger } from '@/lib/api-station/logger';

const logger = createLogger('ConfigStore:SqlDb');

export class SqlDbConfigStore implements ConfigStore {
  /** 注入的数据库执行器（postgres / coze / 本地文件模拟，均可） */
  private readonly db: SqlDb;

  constructor(db: SqlDb) {
    this.db = db;
  }

  async get(key: string): Promise<string | null> {
    try {
      const rows = await this.db.query<{ value: unknown }>(
        'SELECT value FROM runtime_config WHERE key = $1',
        [key]
      );
      if (rows.length === 0) return null;
      return JSON.stringify(rows[0].value);
    } catch (error) {
      logger.error('配置读取失败', error, { key });
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    try {
      // JSONB 语义：可解析为对象则存对象，否则存字符串原值（与旧 GenericDbConfigStore 一致）
      let parsedValue: unknown;
      try {
        parsedValue = JSON.parse(value);
      } catch {
        parsedValue = value;
      }

      const now = new Date();
      await this.db.execute(
        `INSERT INTO runtime_config (key, value, updated_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
        [key, parsedValue, now]
      );

      logger.info('配置已写入', { key });
    } catch (error) {
      logger.error('配置写入失败', error, { key });
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.db.execute('DELETE FROM runtime_config WHERE key = $1', [key]);
      logger.info('配置已删除', { key });
    } catch (error) {
      logger.error('配置删除失败', error, { key });
    }
  }

  async list(prefix: string): Promise<{ key: string; value: string }[]> {
    try {
      const rows = await this.db.query<{ key: string; value: unknown }>(
        'SELECT key, value FROM runtime_config WHERE key LIKE $1 ORDER BY key',
        [`${prefix}%`]
      );
      return rows.map((row) => ({ key: row.key, value: JSON.stringify(row.value) }));
    } catch (error) {
      logger.error('配置查询失败', error, { prefix });
      return [];
    }
  }
}
