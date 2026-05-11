/**
 * 简化版鉴权模块
 *
 * 流程：
 * 1. 格式校验（确保是我们的客户端）
 * 2. 限流（以 key 为 ID）
 * 3. 调用认证服务验证权限
 * 4. 认证服务离线时降级为游客
 *
 * 设计原则：
 * - 业务服务器不持有密钥
 * - 业务服务器不解析 token 内容
 * - key 仅作为限流标识和认证服务查询凭证
 */

import { logInfo, logError } from './logger';
import { checkRateLimit } from './rateLimit';
import { verifyKey } from './authClient';
import { isValidKeyFormat } from './keyFormat';

// Re-export for convenience
export { isValidKeyFormat } from './keyFormat';

export interface AuthResult {
  success: boolean;
  key?: string;
  identityId?: string;
  permissionLevel?: number;
  source?: string;
  error?: string;
  errorCode?: string;
}

/**
 * 从请求头提取 key
 */
export function extractKey(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return null;
  }

  // Bearer <key>
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/**
 * 统一鉴权入口
 *
 * @param request - 请求对象
 * @returns 鉴权结果
 */
export async function authenticate(request: Request): Promise<AuthResult> {
  // 1. 提取 key
  const key = extractKey(request);

  // 2. 格式校验
  if (!key) {
    logError('[Auth] 鉴权失败: key 缺失');
    return {
      success: false,
      error: 'Missing key',
      errorCode: 'MISSING_KEY',
    };
  }

  if (!isValidKeyFormat(key)) {
    logError('[Auth] 鉴权失败: key 格式无效', { keyPreview: key.slice(0, 16) + '...' });
    return {
      success: false,
      error: 'Invalid key format',
      errorCode: 'INVALID_KEY_FORMAT',
    };
  }

  // 3. 限流检查（以 key 为 ID，使用最低权限等级检查）
  const rateLimitResult = checkRateLimit({ subjectId: key, permissionLevel: 1 });
  if (!rateLimitResult.allowed) {
    logError('[Auth] 鉴权失败: 触发限流', { keyPreview: key.slice(0, 8) + '...' });
    return {
      success: false,
      error: rateLimitResult.reason || 'Rate limited',
      errorCode: 'RATE_LIMITED',
    };
  }

  // 4. 调用认证服务
  const verifyResult = await verifyKey(key);

  logInfo('[Auth] 鉴权成功', {
    keyPreview: key.slice(0, 8) + '...',
    permissionLevel: verifyResult.permissionLevel,
    source: verifyResult.source,
  });

  return {
    success: true,
    key,
    identityId: verifyResult.identityId,
    permissionLevel: verifyResult.permissionLevel,
    source: verifyResult.source,
  };
}

// ============ 兼容旧接口（过渡期） ============

/**
 * 统一 token 鉴权
 * @deprecated 使用 authenticate 替代
 */
export async function authenticateUnifiedToken(
  _token: string | null,
  request?: Request,
): Promise<AuthResult> {
  if (!request) {
    return {
      success: false,
      error: 'Missing request',
      errorCode: 'MISSING_REQUEST',
    };
  }
  return authenticate(request);
}

/**
 * Proxy key 鉴权
 * @deprecated 使用 authenticate 替代
 */
export async function authenticateProxyKey(
  _key: string | null,
  request?: Request,
): Promise<AuthResult> {
  if (!request) {
    return {
      success: false,
      error: 'Missing request',
      errorCode: 'MISSING_REQUEST',
    };
  }
  return authenticate(request);
}

/**
 * 检查模型权限
 */
export function checkModelPermission(
  userPermissionLevel: number,
  modelPermissionLevel: number,
): boolean {
  return userPermissionLevel >= modelPermissionLevel;
}

// ============ 废弃的类型和接口（保持类型兼容） ============

/** @deprecated */
export interface ChallengeAuthParams {
  token: string | null;
  answer: string | null;
  nonce: number | null;
}
