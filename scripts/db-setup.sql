-- =============================================================================
-- WanyanAI 数据库初始化（幂等 DDL）
--
-- 适用：CONFIG_STORE=db 模式的目标 PostgreSQL（DATABASE_PROVIDER=postgres 的
-- DATABASE_URL 指向的库，或 DATABASE_PROVIDER=coze 时平台注入的 PG 库）。
--
-- 用法：
--   psql "$DATABASE_URL" -f scripts/db-setup.sql
--
-- 迁移说明：若原生产数据位于 Supabase 项目（旧 CozeDbConfigStore，REST 写入），
-- 先导出 runtime_config 行再导入本库：
--   COPY (SELECT key, value, updated_at FROM runtime_config) TO ...
-- =============================================================================

-- 运行时配置表（KV 存储：子站凭证、模型启停等）
CREATE TABLE IF NOT EXISTS runtime_config (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);