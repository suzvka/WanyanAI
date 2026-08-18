/**
 * WanyanAI 环境变量契约（集群统一声明）
 *
 * 基于 yunzone-service-kit/config 的 defineEnv 语义化声明全部环境变量，
 * 消费点通过 loadEnv 获取类型收敛的 env 对象。
 *
 * 设计约定：
 * - 通用 envSchema 全部 optional：保留各模块现有的"缺省降级/懒加载"行为，
 *   不引入启动即失败（部署环境变量按平台注入）。
 * - 需要必填的模块声明独立子 schema（如 authCenterEnvSchema 三要素），
 *   缺失时由 loadEnv 抛出带诊断快照的 EnvConfigError（不回显变量值）。
 */

import { z } from "zod";
import { defineEnv } from "yunzone-service-kit/config";

/** 通用环境变量契约（全 optional） */
export const envSchema = defineEnv(
  z.object({
    // ── 集群鉴权中心（Token Authority Service）──
    AUTH_CENTER_URL: z.string().optional(),
    AUTH_CENTER_API_KEY: z.string().optional(),
    AUTH_CENTER_PRODUCT_ID: z.string().optional(),

    // ── 用户中心（登录弹窗 / postMessage origin 校验）──
    USER_CENTER_URL: z.string().optional(),
    NEXT_PUBLIC_USER_CENTER_URL: z.string().optional(),

    // ── 管理后台 ──
    ADMIN_PASSWORD: z.string().optional(),

    // ── 部署环境（Coze 平台注入）──
    COZE_PROJECT_ENV: z.string().optional(),
    COZE_PROJECT_DOMAIN_DEFAULT: z.string().optional(),
    HOSTNAME: z.string().optional(),
    DEPLOY_RUN_PORT: z.string().optional(),
    PORT: z.string().optional(),
    COZE_WORKSPACE_PATH: z.string().optional(),

    // ── 账户服务（遗留兼容）──
    ACCOUNT_SERVICE_URL: z.string().optional(),

    // ── 配置存储 ──
    CONFIG_STORE: z.string().optional(),

    // ── Supabase（Coze 平台注入）──
    COZE_SUPABASE_URL: z.string().optional(),
    COZE_SUPABASE_ANON_KEY: z.string().optional(),
    COZE_SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

    // ── 日志 ──
    LOG_LEVEL: z.string().optional(),
    LOG_PRETTY: z.string().optional(),
    NODE_ENV: z.string().optional(),
  })
);

/** 鉴权中心客户端专用：三要素必填，缺失时抛 EnvConfigError（含诊断快照） */
export const authCenterEnvSchema = defineEnv(
  z.object({
    AUTH_CENTER_URL: z.string().min(1),
    AUTH_CENTER_API_KEY: z.string().min(1),
    AUTH_CENTER_PRODUCT_ID: z.string().min(1),
  })
);
