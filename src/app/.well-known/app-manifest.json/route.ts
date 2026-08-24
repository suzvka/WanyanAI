/**
 * 标准应用目录端点（AppManifest v1 契约，kit 托管）
 *
 * 路径约定：/.well-known/app-manifest.json（RFC 8615 well-known 前缀）
 * 消费方（用户中心）按此路径拉取本应用自述；契约校验与响应头由
 * yunzone-service-kit/app/next 统一托管（运行时 parseAppManifest 兜底）。
 */
import type { AppManifest } from "yunzone-service-kit/app";
import { createAppManifestHandler } from "yunzone-service-kit/app/next";
import rawManifest from "@/manifest/app-manifest.json";

// JSON 模块的枚举字段（status）被推断为 string，经契约类型断言；
// 运行时由 handler 内 parseAppManifest 校验兜底
const manifest = rawManifest as AppManifest;

export const GET = createAppManifestHandler({ manifest });
