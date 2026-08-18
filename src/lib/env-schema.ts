/**
 * WanyanAI 环境变量契约（集群统一声明）
 *
 * 基于 yunzone-service-kit/config 的 env 分面规范组合声明：
 * - 集群通用分面：deploymentFacet（部署面）/ authCenterFacet（鉴权中心面）/
 *   userCenterFacet（用户中心面）/ adminFacet（管理面）
 * - 本地独有字段（日志/配置存储/Supabase/遗留账户服务）用 extend 追加
 *
 * 设计约定：
 * - 通用 envSchema 全部 optional：保留各模块现有的"缺省降级/懒加载"行为，
 *   不引入启动即失败（部署环境变量按平台注入）。
 * - 需要必填的模块声明独立子 schema（如 authCenterEnvSchema 三要素），
 *   缺失时由 loadEnv 抛出带诊断快照的 EnvConfigError（不回显变量值）。
 */

import { z } from "zod";
import {
  adminFacet,
  authCenterFacet,
  composeFacets,
  deploymentAliases,
  deploymentFacet,
  requiredFacet,
  userCenterFacet,
} from "yunzone-service-kit/config";

/** 通用环境变量契约（全 optional） */
export const envSchema = composeFacets(
  deploymentFacet,
  authCenterFacet,
  userCenterFacet,
  adminFacet
).extend({
  // ── 账户服务（遗留兼容）──
  ACCOUNT_SERVICE_URL: z.string().optional(),

  // ── 配置存储 ──
  CONFIG_STORE: z.string().optional(),

  // ── Supabase（Coze 平台注入，项目私有层显式声明，TICKET-001）──
  // 键名保留平台注入原名，属服务自有 schema 扩展（私有命名空间），
  // 不进入 service-kit 通用契约
  COZE_SUPABASE_URL: z.string().optional(),
  COZE_SUPABASE_ANON_KEY: z.string().optional(),
  COZE_SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  // ── 日志 ──
  LOG_LEVEL: z.string().optional(),
  LOG_PRETTY: z.string().optional(),
  NODE_ENV: z.string().optional(),
});

/**
 * 通用契约 loadEnv 选项：
 * 部署面平台注入旧名经 deploymentAliases 映射到中立键（TICKET-001 适配层，永久保留，
 * 因为平台注入变量名本身不可改名；服务代码一律使用中立键）。
 */
export const envLoadOptions = { aliases: deploymentAliases, dotenv: true } as const;

/** 鉴权中心客户端专用：三要素必填，缺失时抛 EnvConfigError（含诊断快照） */
export const authCenterEnvSchema = requiredFacet(authCenterFacet, [
  "AUTH_CENTER_URL",
  "AUTH_CENTER_API_KEY",
  "AUTH_CENTER_PRODUCT_ID",
]);
