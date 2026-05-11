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
 * 降级策略：
 * - 无 key → 游客权限（使用 IP 作为限流标识）
 * - key 格式无效 → 游客权限
 * - 认证服务离线 → 游客权限
 * - key 无效 → 游客权限
 *
 * 只有触发限流时才会拒绝请求。
 *
 * @param request - 请求对象
 * @returns 鉴权结果
 */
export async function authenticate(request: Request): Promise<AuthResult> {
  // 1. 提取 key
  const key = extractKey(request);

  // 2. 无 key → 降级为游客（使用 IP 作为限流标识）
  if (!key) {
    const clientIp = extractClientIp(request) || 'anonymous';
    const rateLimitKey = `guest:${clientIp}`;

    logInfo('[Auth] 无 key，降级为游客', { rateLimitKey });

    // 限流检查
    const rateLimitResult = checkRateLimit({ subjectId: rateLimitKey, permissionLevel: 1 });
    if (!rateLimitResult.allowed) {
      logError('[Auth] 游客触发限流', { rateLimitKey });
      return {
        success: false,
        error: rateLimitResult.reason || 'Rate limited',
        errorCode: 'RATE_LIMITED',
      };
    }

    return {
      success: true,
      key: rateLimitKey,
      permissionLevel: 1, // 游客
      source: 'no-key-fallback',
    };
  }

  // 3. key 格式无效 → 降级为游客
  if (!isValidKeyFormat(key)) {
    const clientIp = extractClientIp(request) || 'anonymous';
    const rateLimitKey = `invalid-key:${clientIp}`;

    logInfo('[Auth] key 格式无效，降级为游客', { keyPreview: key.slice(0, 16) + '...' });

    // 限流检查
    const rateLimitResult = checkRateLimit({ subjectId: rateLimitKey, permissionLevel: 1 });
    if (!rateLimitResult.allowed) {
      logError('[Auth] 无效 key 触发限流', { rateLimitKey });
      return {
        success: false,
        error: rateLimitResult.reason || 'Rate limited',
        errorCode: 'RATE_LIMITED',
      };
    }

    return {
      success: true,
      key: rateLimitKey,
      permissionLevel: 1, // 游客
      source: 'invalid-key-fallback',
    };
  }

  // 4. 限流检查（以 key 为 ID，使用最低权限等级检查）
  const rateLimitResult = checkRateLimit({ subjectId: key, permissionLevel: 1 });
  if (!rateLimitResult.allowed) {
    logError('[Auth] 鉴权失败: 触发限流', { keyPreview: key.slice(0, 8) + '...' });
    return {
      success: false,
      error: rateLimitResult.reason || 'Rate limited',
      errorCode: 'RATE_LIMITED',
    };
  }

  // 5. 调用认证服务
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

/**
 * 从请求中提取客户端 IP
 */
function extractClientIp(request: Request): string | null {
  const forwardedFor = request.headers.get('X-Forwarded-For');
  if (forwardedFor) {
    const ip = forwardedFor.split(',')[0]?.trim();
    if (ip) return ip;
  }

  const realIp = request.headers.get('X-Real-IP');
  if (realIp) return realIp.trim();

  const cfIp = request.headers.get('CF-Connecting-IP');
  if (cfIp) return cfIp.trim();

  return null;
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
