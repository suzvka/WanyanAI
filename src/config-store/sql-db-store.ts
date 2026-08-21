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
      // 统一序列化为合法 JSON 文本后再入库（JSONB 语义）：
      // 不能把 JSON.parse 后的 JS 值直接传给 pg 驱动——pg 会把 JS 数组序列化为
      // PostgreSQL 数组字面量（如 {"{\"id\":\"x\"}"}）而非 JSON 数组，写入 JSONB
      // 列会抛 "invalid input syntax for type json"。统一传 JSON 文本，由
      // PostgreSQL（text → jsonb 隐式转换）/ FileSqlDb（解析为 JS 值）各自完成转换。
      let jsonText: string;
      try {
        // 可解析为 JSON 则规整化（保证是合法 JSON 文本）
        jsonText = JSON.stringify(JSON.parse(value));
      } catch {
        // 非 JSON 字符串：包装为 JSON 字符串字面量，保证 JSONB 列可接受
        jsonText = JSON.stringify(value);
      }

      const now = new Date();
      await this.db.execute(
        `INSERT INTO runtime_config (key, value, updated_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
        [key, jsonText, now]
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
