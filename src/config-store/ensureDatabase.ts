/**
 * 启动期数据库引导：确保业务库存在（不存在则自动创建），并确保应用表就绪
 *
 * 场景：业务库（如 DATABASE_URL 指向的 wanyan）在远端 PostgreSQL 上尚未创建时，
 * 配置存储（ConfigStore）将无法建表/读写。本模块在服务启动时先连接系统库
 * （postgres，PostgreSQL 自带的维护库），检查目标业务库是否存在，不存在则自动
 * `CREATE DATABASE`；随后连接业务库，幂等确保 `runtime_config` 表存在
 * （结构与 scripts/db-setup.sql 一致），使首次请求到达时配置存储即可用。
 *
 * 设计约定：
 * - 仅 `DATABASE_PROVIDER` 为 postgres / coze 且连接串可解析时执行；none 跳过
 *   （显式无库，走 FileSqlDb，无需数据库）。
 * - 幂等：目标库已存在则跳过创建；表已存在则跳过建表；并发启动的多个实例同时
 *   创建库时，42P04（duplicate_database）竞态视为成功。
 * - 失败不阻塞服务启动：连接串缺失 / 无 CREATEDB 权限 / 网络不通等场景
 *   仅记录告警并返回 false，与现有"数据库可降级"语义一致，但会明确提示人工介入。
 * - 安全：`CREATE DATABASE` 不支持参数化，目标库名必须通过 PostgreSQL 标识符
 *   白名单校验后双引号包裹，杜绝注入。
 *
 * 注意：本模块在 tsx node 进程（src/server.ts）与 Next 服务端路由（RSC）两处运行，
 * 因此不引入 'server-only' 标记（该包在非 React Server 环境会主动抛错）。
 */

import { Client } from 'pg';
// 相对路径导入：本模块同时被 tsx watch（server.ts，经 Next require-hook）与
// Next 服务端路由加载，均不保证 @/ 别名可用。
import { createLogger } from '../lib/api-station/logger';

const logger = createLogger('EnsureDatabase');

/** PostgreSQL 标识符白名单（字母/数字/下划线，首字符不为数字） */
const DB_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** 引导连接超时（毫秒）：连不上系统库时快速失败，避免阻塞启动 */
const CONNECT_TIMEOUT_MS = 5000;

/** 运行时配置表 DDL（与 scripts/db-setup.sql 保持一致，幂等） */
const RUNTIME_TABLE_DDL = `
  CREATE TABLE IF NOT EXISTS runtime_config (
    key        TEXT PRIMARY KEY,
    value      JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;

/**
 * 确保业务数据库与应用表就绪
 *
 * @returns true = 库与表均已确保（含本次创建）；false = 跳过或失败（原因已记录日志）
 */
export async function ensureDatabaseExists(): Promise<boolean> {
  const channel = process.env.DATABASE_PROVIDER || 'postgres';
  if (channel === 'none') {
    logger.debug('跳过自动建库（DATABASE_PROVIDER=none，无需数据库）');
    return false;
  }
  if (channel !== 'postgres' && channel !== 'coze') {
    logger.warn('跳过自动建库：DATABASE_PROVIDER 非法', { channel });
    return false;
  }

  // 解析业务库连接串（postgres → DATABASE_URL[+DATABASE_PASSWORD 分段]；coze → PG* 组）
  const bizUrl = resolveBusinessUrl(channel);
  if (!bizUrl) {
    logger.warn('跳过自动建库：数据库连接串不可用（见上方诊断）', { channel });
    return false;
  }

  // 提取目标库名 + 派生系统库连接串
  const dbName = extractDbName(bizUrl);
  if (!dbName) {
    logger.warn('跳过自动建库：无法从连接串解析库名', { url: maskUrl(bizUrl) });
    return false;
  }
  if (!DB_NAME_RE.test(dbName)) {
    logger.warn('跳过自动建库：库名含非法字符，拒绝自动 CREATE DATABASE', { dbName });
    return false;
  }
  const sysUrl = toSystemDbUrl(bizUrl);
  if (!sysUrl) {
    logger.warn('跳过自动建库：无法派生系统库连接串', { dbName });
    return false;
  }

  // 阶段 1：确保业务库存在（系统库连接）
  const dbReady = await ensureBusinessDatabase(bizUrl, dbName, sysUrl);
  if (!dbReady) return false;

  // 阶段 2：确保应用表就绪（业务库连接，幂等；失败不阻断库已就绪的事实）
  await ensureRuntimeTable(bizUrl, dbName);

  return true;
}

/**
 * 阶段 1：连接系统库，检查目标业务库是否存在，不存在则自动创建
 */
async function ensureBusinessDatabase(bizUrl: string, dbName: string, sysUrl: string): Promise<boolean> {
  const client = new Client({ connectionString: sysUrl, connectionTimeoutMillis: CONNECT_TIMEOUT_MS });
  try {
    await client.connect();
    const { rows } = await client.query<{ exists: boolean }>(
      'SELECT EXISTS(SELECT 1 FROM pg_catalog.pg_database WHERE datname = $1) AS "exists"',
      [dbName],
    );
    if (rows[0]?.exists) {
      logger.info('业务库已存在，跳过创建', { dbName });
      return true;
    }

    try {
      await client.query(`CREATE DATABASE "${dbName}"`);
      logger.info('业务库已自动创建', { dbName });
      return true;
    } catch (err) {
      // 并发竞态：多个实例同时检查到不存在并同时创建 → 视为成功
      if (isDuplicateDatabase(err)) {
        logger.info('业务库已被并发实例创建，视为成功', { dbName });
        return true;
      }
      throw err;
    }
  } catch (err) {
    logger.warn('自动建库失败，请人工确认业务库可用（服务继续启动，配置存储将降级）', {
      dbName,
      reason: (err as Error).message,
    });
    return false;
  } finally {
    await client.end().catch(() => {});
  }
}

/**
 * 阶段 2：连接业务库，幂等确保 runtime_config 表存在
 */
async function ensureRuntimeTable(bizUrl: string, dbName: string): Promise<void> {
  const client = new Client({ connectionString: bizUrl, connectionTimeoutMillis: CONNECT_TIMEOUT_MS });
  try {
    await client.connect();
    await client.query(RUNTIME_TABLE_DDL);
    logger.info('应用表已就绪（runtime_config）', { dbName });
  } catch (err) {
    logger.warn('确保应用表失败，配置存储可能不可用（请用 scripts/db-setup.sql 人工初始化）', {
      dbName,
      reason: (err as Error).message,
    });
  } finally {
    await client.end().catch(() => {});
  }
}

/**
 * 解析业务库连接串（与 kit `resolveDatabaseUrl` 同语义，仅抽取连接串，
 * 便于在拿不到合法连接串时优雅跳过而非抛错）
 */
function resolveBusinessUrl(channel: 'postgres' | 'coze'): string | null {
  const env = process.env;
  if (channel === 'postgres') {
    const url = env.DATABASE_URL;
    if (!url) {
      logger.warn('自动建库不可用：DATABASE_URL 未设置');
      return null;
    }
    if (env.DATABASE_PASSWORD) {
      try {
        const parsed = new URL(url);
        parsed.password = encodeURIComponent(env.DATABASE_PASSWORD);
        return parsed.toString();
      } catch {
        logger.warn(
          '自动建库不可用：DATABASE_URL 非法（分段模式要求 URL 不含密码且 userinfo 无原始特殊字符）',
        );
        return null;
      }
    }
    return url;
  }
  // coze 渠道：优先平台注入的完整连接串，其次 PG* 拆分变量
  if (env.PGDATABASE_URL) {
    return env.PGDATABASE_URL.replace(/\?.*$/, '');
  }
  const { PGHOST, PGPORT = '5432', PGUSER, PGPASSWORD, PGDATABASE = 'postgres', PGSSLMODE } = env;
  if (!PGHOST || !PGUSER || !PGPASSWORD) {
    logger.warn('自动建库不可用：coze 渠道必需变量缺失（PGHOST/PGUSER/PGPASSWORD）');
    return null;
  }
  const url = new URL(
    `postgresql://${PGUSER}:${encodeURIComponent(PGPASSWORD)}@${PGHOST}:${PGPORT}/${PGDATABASE}`,
  );
  if (PGSSLMODE) url.searchParams.set('sslmode', PGSSLMODE);
  return url.toString();
}

/** 从连接串提取库名（路径段，URL 解码） */
function extractDbName(url: string): string | null {
  try {
    const name = new URL(url).pathname.replace(/^\//, '').replace(/\/$/, '');
    return name ? decodeURIComponent(name) : null;
  } catch {
    return null;
  }
}

/** 派生系统库连接串：库名替换为 postgres（保留 user/password/host/port/query） */
function toSystemDbUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    parsed.pathname = '/postgres';
    return parsed.toString();
  } catch {
    return null;
  }
}

/** 判断 CREATE DATABASE 的"库已存在"竞态错误（pg code 42P04 或消息含 already exists） */
function isDuplicateDatabase(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  return e?.code === '42P04' || /already exists/i.test(e?.message ?? '');
}

/** 脱敏连接串（隐藏密码，仅用于日志） */
function maskUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = '***';
    return parsed.toString();
  } catch {
    return '(unparsable)';
  }
}
