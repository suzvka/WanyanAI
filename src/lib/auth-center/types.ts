/**
 * 鉴权中心（Token Authority Service）客户端类型定义
 *
 * 基于 Token 鉴权服务 API v1.1
 */

// ============ 请求类型 ============

/** 颁发 Token 请求 */
export interface IssueTokenRequest {
  userId: string;
  productId: string;
  scope?: string[];
  claims?: Record<string, unknown>;
  /**
   * 公开声明（匿名/跨产品 introspect 可见）。账户锚点 accountId 由调用方自报，
   * 登记表只存不校验（token-contract v1.6：账户背书与支付风控归消费方与积分域）。
   */
  publicClaims?: Record<string, unknown>;
  ttl?: number; // 秒，默认 86400 (24h)
}

/** 校验 Token 请求 */
export interface IntrospectTokenRequest {
  token: string;
  scope?: string[];
}

/** 刷新 Token 请求 */
export interface RefreshTokenRequest {
  token: string;
  ttl?: number;
}

/** 吊销 Token 请求 */
export interface RevokeTokenRequest {
  token?: string;
  userId?: string;
  productId: string;
}

// ============ 响应类型 ============

/** 颁发 Token 响应 */
export interface IssueTokenResponse {
  token: string;
  expiresAt: string;
  userId: string;
  productId: string;
  scope: string[];
}

/** 校验 Token 响应（有效） */
export interface IntrospectTokenActiveResponse {
  active: true;
  userId: string;
  productId: string;
  scope: string[];
  claims: Record<string, unknown>;
  expiresAt: string;
}

/** 校验 Token 响应（无效） */
export interface IntrospectTokenInactiveResponse {
  active: false;
}

export type IntrospectTokenResponse =
  | IntrospectTokenActiveResponse
  | IntrospectTokenInactiveResponse;

/** 刷新 Token 响应 */
export interface RefreshTokenResponse {
  success: boolean;
  expiresAt: string;
}

/** 吊销 Token 响应 */
export interface RevokeTokenResponse {
  success: boolean;
}

/** 健康检查响应 */
export interface HealthCheckResponse {
  status: string;
  db: string;
  timestamp: string;
}

// ============ 错误响应 ============

export interface AuthCenterError {
  code: string;
  message: string;
}

// ============ 业务类型 ============

/** 会员等级字符串 → 权限等级数值映射 */
export const MEMBERSHIP_TO_PERMISSION: Record<string, number> = {
  free: 1,
  vip: 2,
  svip: 3,
  admin: 99,
};

/** 默认游客权限等级 */
export const DEFAULT_PERMISSION_LEVEL = 1;

/** 从 claims 中提取会员等级对应的权限等级 */
export function getPermissionLevelFromClaims(
  claims: Record<string, unknown> | undefined,
): number {
  if (!claims) return DEFAULT_PERMISSION_LEVEL;
  const membershipLevel = claims.membershipLevel as string | undefined;
  if (!membershipLevel) return DEFAULT_PERMISSION_LEVEL;
  return MEMBERSHIP_TO_PERMISSION[membershipLevel] ?? DEFAULT_PERMISSION_LEVEL;
}