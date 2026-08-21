/**
 * FileSqlDb — 本地 json 文件实现的 SqlDb（数据库抽象的非库渠道）
 *
 * 定位（依赖倒置）：
 * 数据库抽象（SqlDb 契约，yunzone-service-kit/db）允许多种底层实现——
 * postgres 连接（DATABASE_URL）、coze 集成（PG* 变量组）、或本实现的
 * "本地 json 文件模拟数据库行为"（DATABASE_PROVIDER=none 时由消费方选用）。
 * 本类不感知业务，仅按 SqlDb 契约执行参数化 SQL；对契约未知的 SQL fail-fast。
 *
 * 模拟范围（runtime_config 表，与 scripts/db-setup.sql 对齐）：
 * - SELECT value FROM runtime_config WHERE key = $1
 * - SELECT key, value FROM runtime_config WHERE key LIKE $1 ORDER BY key
 * - INSERT INTO runtime_config (key, value, updated_at) VALUES ($1,$2,$3)
 *   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
 * - DELETE FROM runtime_config WHERE key = $1
 *
 * 持久化语义：
 * - 单文件 json（默认 <WORKSPACE_PATH>/runtime-config/db.json）模拟一张表
 * - 写入采用"临时文件 + rename"原子替换，避免半写状态
 * - 事务：内存快照 + 提交时整体落盘；失败恢复快照（不落盘）
 */

import 'server-only';

import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import path from 'node:path';
import { StorageError } from 'yunzone-service-kit/db';
import type { SqlDb } from 'yunzone-service-kit/db';
import { loadEnv } from 'yunzone-service-kit/config';
import { envSchema, envLoadOptions } from '@/lib/env-schema';
import { createLogger } from '@/lib/api-station/logger';

const logger = createLogger('ConfigStore:FileDb');

/** 单文件数据目录（与旧 FileConfigStore 保持一致，便于原地迁移） */
const CONFIG_DIR = 'runtime-config';
/** 数据文件名（模拟 runtime_config 表） */
const DB_FILE = 'db.json';

/** 行结构（对齐 runtime_config 表：key/value/updated_at） */
interface FileRow {
  value: unknown;
  updated_at: string;
}

/** 归一化 SQL（压缩空白、转小写），用于契约子集匹配 */
function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim().toLowerCase();
}

/** 受支持的 SQL 子集（与本文件顶部的契约一致） */
const SQL_GET = normalizeSql(
  'SELECT value FROM runtime_config WHERE key = $1'
);
const SQL_LIST = normalizeSql(
  'SELECT key, value FROM runtime_config WHERE key LIKE $1 ORDER BY key'
);
const SQL_UPSERT = normalizeSql(
  `INSERT INTO runtime_config (key, value, updated_at)
   VALUES ($1, $2, $3)
   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`
);
const SQL_DELETE = normalizeSql(
  'DELETE FROM runtime_config WHERE key = $1'
);

/** 仅支持单表（模拟对象），表名不合法即 fail-fast */
const ALLOWED_TABLE = 'runtime_config';

export class FileSqlDb implements SqlDb {
  /** 内存表（模拟 runtime_config 表数据） */
  private rows = new Map<string, FileRow>();
  /** 数据文件绝对路径 */
  private readonly filePath: string;
  /** 持久化锁（串行化并发写盘） */
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(baseDir?: string) {
    // TICKET-001：工作区路径经中立键读取（COZE_WORKSPACE_PATH 由适配层回退）
    const root = baseDir ?? loadEnv(envSchema, envLoadOptions).WORKSPACE_PATH ?? process.cwd();
    this.filePath = path.join(root, CONFIG_DIR, DB_FILE);
    this.load();
  }

  /** 启动时从文件加载（不存在则视为空表） */
  private load(): void {
    try {
      if (!existsSync(this.filePath)) {
        logger.info('数据库文件不存在，初始化为空表', { filePath: this.filePath });
        return;
      }
      const raw = JSON.parse(readFileSync(this.filePath, 'utf-8')) as {
        [ALLOWED_TABLE]?: Record<string, FileRow>;
      };
      const table = raw[ALLOWED_TABLE];
      if (table && typeof table === 'object') {
        for (const [key, row] of Object.entries(table)) {
          this.rows.set(key, row);
        }
      }
      logger.info('数据库文件已加载', { rowCount: this.rows.size, filePath: this.filePath });
    } catch (error) {
      logger.error('数据库文件解析失败，按空表处理（保留原文件不覆盖）', error, {
        filePath: this.filePath,
      });
    }
  }

  /** 原子持久化：写临时文件后 rename 覆盖 */
  private persist(): Promise<void> {
    this.writeQueue = this.writeQueue.then(() => {
      const dir = path.dirname(this.filePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      const table: Record<string, FileRow> = {};
      this.rows.forEach((row, key) => {
        table[key] = row;
      });
      const payload = JSON.stringify({ [ALLOWED_TABLE]: table }, null, 2);
      const tmpPath = `${this.filePath}.${process.pid}.tmp`;
      writeFileSync(tmpPath, payload, 'utf-8');
      renameSync(tmpPath, this.filePath);
    });
    return this.writeQueue;
  }

  /** LIKE 模式 → 前缀匹配（当前仅支持 `prefix%` 形态） */
  private matchLike(pattern: string, key: string): boolean {
    if (pattern.endsWith('%')) {
      return key.startsWith(pattern.slice(0, -1));
    }
    return key === pattern;
  }

  /** 断言参数数量（模拟 SQL 参数绑定校验） */
  private expectParams(sql: string, params: unknown[], count: number): void {
    if (params.length !== count) {
      throw new StorageError(
        `[file-db] SQL 参数数量不匹配：期望 ${count}，实际 ${params.length}（SQL: ${sql}）`
      );
    }
  }

  async query<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = []
  ): Promise<T[]> {
    const normalized = normalizeSql(sql);
    const results: T[] = [];

    if (normalized === SQL_GET) {
      this.expectParams(sql, params, 1);
      const row = this.rows.get(String(params[0]));
      if (row) results.push({ value: row.value } as T);
      return results;
    }

    if (normalized === SQL_LIST) {
      this.expectParams(sql, params, 1);
      const pattern = String(params[0]);
      for (const [key, row] of this.rows) {
        if (this.matchLike(pattern, key)) {
          results.push({ key, value: row.value } as T);
        }
      }
      // ORDER BY key（字符串升序）
      results.sort((a, b) => String((a as { key: string }).key).localeCompare(String((b as { key: string }).key)));
      return results;
    }

    throw new StorageError(
      `[file-db] 不支持的 SQL（本实现仅模拟 runtime_config 表的 CRUD 子集）: ${normalized}`
    );
  }

  async execute(sql: string, params: unknown[] = []): Promise<number> {
    const normalized = normalizeSql(sql);

    if (normalized === SQL_UPSERT) {
      this.expectParams(sql, params, 3);
      const [key, value, updatedAt] = params as [string, unknown, Date | string];
      this.rows.set(key, {
        value,
        updated_at: updatedAt instanceof Date ? updatedAt.toISOString() : String(updatedAt),
      });
      await this.persist();
      return 1;
    }

    if (normalized === SQL_DELETE) {
      this.expectParams(sql, params, 1);
      const key = String(params[0]);
      const existed = this.rows.delete(key);
      await this.persist();
      return existed ? 1 : 0;
    }

    throw new StorageError(
      `[file-db] 不支持的 SQL（本实现仅模拟 runtime_config 表的 CRUD 子集）: ${normalized}`
    );
  }

  async withTransaction<T>(fn: (db: SqlDb) => Promise<T>): Promise<T> {
    // 快照（深拷贝），用于失败回滚
    const snapshot = new Map<string, FileRow>();
    this.rows.forEach((row, key) => {
      snapshot.set(key, structuredClone(row));
    });

    try {
      const result = await fn(this);
      // 整体提交：落盘当前内存态
      await this.persist();
      return result;
    } catch (error) {
      // 整体回滚：恢复内存快照，不落盘
      this.rows = snapshot;
      logger.warn('事务回滚，内存态已恢复快照', { reason: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }
}
