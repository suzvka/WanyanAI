/**
 * 权限解析相关类型定义
 *
 * 本模块仅负责将 key 映射为权限等级（permissionLevel），
 * 实际的身份认证（登录、用户验证等）由外部商业认证服务完成。
 *
 * key 的双重用途：
 * 1. 权限查询凭证：通过外部服务查询对应的 permissionLevel（用于限流）
 * 2. 上游 API Key：openai-forward 站将 key 直接作为上游模型服务的 API Key
 */

// ============ 核心类型 ============

/** 游客权限等级 */
export const GUEST_PERMISSION_LEVEL = 1;

/** 权限角色 */
export type PermissionRole = 'guest' | 'member' | 'admin';

/** 身份类型 */
export type SubjectType = 'guest' | 'user';

/** 权限查询结果 */
export interface PermissionResult {
  success: boolean;
  key?: string;
  identityId?: string;
  permissionLevel?: number;
  source?: string;
  error?: string;
  errorCode?: string;
}