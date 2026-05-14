/**
 * 鉴权相关类型定义（简化版）
 *
 * 新架构下，key 仅作为：
 * 1. 限流标识（业务服务器）
 * 2. 权限查询凭证（认证服务器）
 */

// ============ 核心类型 ============

/** 游客权限等级 */
export const GUEST_PERMISSION_LEVEL = 1;

/** 权限角色 */
export type PermissionRole = 'guest' | 'member' | 'admin';

/** 身份类型 */
export type SubjectType = 'guest' | 'user';

/** 鉴权结果 */
export interface AuthResult {
  success: boolean;
  key?: string;
  identityId?: string;
  permissionLevel?: number;
  source?: string;
  error?: string;
  errorCode?: string;
}

// ============ 废弃类型（保持向后兼容） ============

/**
 * @deprecated 新架构下不再使用 ProxyKey
 */
export interface ProxyKeyPayloadV1 {
  version: 'v1';
  userRef: string;
  sessionId: string | null;
  issuedAt: number;
  expiresAt: number;
  permissionHint: PermissionRole;
  powSeed?: string | null;
}

/**
 * @deprecated 新架构下不再使用 ProxyKey
 */
export interface ProxyKeySessionBinding {
  visitorIdHash: string;
}

/**
 * @deprecated 新架构下不再使用 ProxyKey
 */
export interface ProxyKeyPayloadV2 {
  version: 'v2';
  subjectType: SubjectType;
  subjectId: string;
  userRef: string | null;
  sessionId: string;
  sessionBinding: ProxyKeySessionBinding;
  issuedAt: number;
  expiresAt: number;
  permissionHint: PermissionRole;
  keyUse: 'model_proxy';
}

/**
 * @deprecated 新架构下不再使用 ProxyKey
 */
export type ProxyKeyPayload = ProxyKeyPayloadV1 | ProxyKeyPayloadV2;

/**
 * @deprecated 新架构下不再使用 ProxyKey
 */
export interface ProxyKeyVerificationResult {
  success: boolean;
  subjectType?: SubjectType;
  subjectId?: string;
  userRef?: string;
  sessionId?: string | null;
  proof?: string;
  payload?: ProxyKeyPayload;
  error?: string;
  errorCode?: string;
}

/**
 * @deprecated 权限解析已移至认证服务器
 */
export interface ResolvedPermissionProfile {
  subjectType: SubjectType;
  subjectId: string;
  userRef: string | null;
  permissionLevel: number;
  role: PermissionRole;
  isAuthenticated: boolean;
  source: 'guest-fallback' | 'account-hook';
}
