/**
 * WanyanAI 环境变量契约（集群统一声明）
 *
 * 基于 yunzone-service-kit/config 的 env 分面规范组合声明：
 * - 集群通用分面：deploymentFacet（部署面）/ authCenterFacet（鉴权中心面）/
 *   adminFacet（管理面）
 * - 本地平台认证面（platformAuthFacet）：云洲平台统一认证服务接入配置。
 *   以平台为本位命名（PLATFORM_*），不绑定具体子服务（用户中心仅是当前实现者）；
 *   服务凭证由鉴权中心统一签发，用户中心仅透传验证。
 * - 本地独有字段（日志/配置存储/数据库）用 extend 追加
 *
 * 设计约定：
 * - 通用 envSchema 全部 optional：保留各模块现有的"缺省降级/懒加载"行为，
 *   不引入启动即失败（部署环境变量按平台注入）。
 * - 需要必填的模块声明独立子 schema（如 authCenterEnvSchema 三要素），
 *   缺失时由 loadEnv 抛出带诊断快照的 EnvConfigError（不回显变量值）。
 * - 数据库键组与 yunzone_user_center 对齐：DATABASE_PROVIDER 显式分派
 *   （postgres 默认走 DATABASE_URL；coze 走平台注入 PG* 组），不自动嗅探。
 */

import { z } from "zod";
import {
  adminFacet,
  authCenterFacet,
  composeFacets,
  deploymentAliases,
  deploymentFacet,
  requiredFacet,
} from "yunzone-service-kit/config";

/**
 * 平台认证面（云洲平台统一认证服务接入配置）
 *
 * - PLATFORM_AUTH_URL：平台认证服务地址（登录弹窗/回调/origin 校验）
 * - 服务凭证复用鉴权中心唯一凭证 AUTH_CENTER_API_KEY：
 *   client_secret = apiKey 明文；client_id = SHA-256(apiKey)（服务端派生，
 *   即鉴权中心签发时的 token_hash，同一凭证的公开别名），无需独立签发。
 */
const platformAuthFacet = z.object({
  PLATFORM_AUTH_URL: z.string().optional(),
});

/** 通用环境变量契约（全 optional） */
export const envSchema = composeFacets(
  deploymentFacet,
  authCenterFacet,
  platformAuthFacet,
  adminFacet
).extend({
  // ── 配置存储 ──
  CONFIG_STORE: z.string().optional(),

  // ── 数据库（通用 PostgreSQL，DATABASE_PROVIDER 分派，与 yunzone_user_center 一致）──
  // 数据库模式：postgres（通用，默认）| coze（Coze 平台数据库集成）
  DATABASE_PROVIDER: z.string().default("postgres"),
  // 通用连接串（DATABASE_PROVIDER=postgres 时使用）
  DATABASE_URL: z.string().optional(),
  // Coze 平台拆分参数（DATABASE_PROVIDER=coze 时由平台注入）
  PGDATABASE_URL: z.string().optional(),
  PGHOST: z.string().optional(),
  PGPORT: z.string().optional(),
  PGUSER: z.string().optional(),
  PGPASSWORD: z.string().optional(),
  PGDATABASE: z.string().optional(),
  PGSSLMODE: z.string().optional(),

  // ── 日志 ──
  LOG_LEVEL: z.string().optional(),
  LOG_PRETTY: z.string().optional(),
  NODE_ENV: z.string().optional(),
});

/**
 * 通用契约 loadEnv 选项：
 * - 部署面平台注入旧名经 deploymentAliases 映射到中立键（TICKET-001 适配层，永久保留，
 *   因为平台注入变量名本身不可改名；服务代码一律使用中立键）；
 * - 数据库凭证无平台注入别名：DATABASE_PROVIDER 显式分派（postgres/coze），不自动嗅探。
 */
export const envLoadOptions: {
  aliases: Record<string, string[]>;
  dotenv: boolean;
} = {
  aliases: {
    ...deploymentAliases,
  },
  dotenv: true,
};

/** 鉴权中心客户端专用：三要素必填，缺失时抛 EnvConfigError（含诊断快照） */
export const authCenterEnvSchema = requiredFacet(authCenterFacet, [
  "AUTH_CENTER_URL",
  "AUTH_CENTER_API_KEY",
  "AUTH_CENTER_PRODUCT_ID",
]);

/**
 * 平台认证客户端专用：必填项为平台认证地址 + 鉴权中心唯一凭证（AUTH_CENTER_API_KEY），
 * 缺失时抛 EnvConfigError（含诊断快照）。
 * 注意：authCenterEnvSchema 额外要求 AUTH_CENTER_URL/PRODUCT_ID（直连鉴权中心场景），
 * 平台认证面只需凭证本身，不要求鉴权中心地址。
 */
export const platformAuthEnvSchema = requiredFacet(
  composeFacets(platformAuthFacet, authCenterFacet),
  ["PLATFORM_AUTH_URL", "AUTH_CENTER_API_KEY"]
);
