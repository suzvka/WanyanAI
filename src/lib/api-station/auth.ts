/**
 * 简化版鉴权模块
 *
 * 流程：
 * 1. 限流检查（任何场景下都有效）
 * 2. 检查认证服务是否可用
 *    - 不可用 → 跳过格式校验 + 跳过权限校验 → 返回默认权限
 *    - 可用 → 继续
 * 3. 格式校验
 *    - 无效 → 返回默认权限
 *    - 有效 → 继续
 * 4. 调用认证服务获取权限等级
 *
 * 设计原则：
 * - 限流在任何场景下有效（本地查表）
 * - 认证服务器不可用时，任意 key 都能通过验证且获取默认权限
 * - 业务服务器不持有密钥
 * - 业务服务器不解析 token 内容
 */

import { logInfo, logWarn, logError } from './logger';
import { checkRateLimit } from './rateLimit';
import { verifyKey, isAuthServiceAvailable, getFallbackPermissionLevel } from './authClient';
import { isValidKeyFormat } from './keyFormat';

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
 * 从请求提取客户端 IP
 */
function extractClientIp(request: Request): string | null {
  const forwardedFor = request.headers.get('X-Forwarded-For');
  if (forwardedFor) {
    const ip = forwardedFor.split(',')[0]?.trim();
    if (ip) return ip;
  }

  const realIp = request.headers.get('X-Real-IP')?.trim();
  if (realIp) return realIp;

  const cfIp = request.headers.get('CF-Connecting-IP')?.trim();
  return cfIp || null;
}

/**
 * 获取限流标识（优先使用 key，其次使用 IP）
 */
function getRateLimitId(request: Request, key: string | null): string {
  // 有 key 就用 key（不管格式是否有效）
  if (key) {
    return `key:${key}`;
  }

  const ip = extractClientIp(request);
  if (ip) {
    return `ip:${ip}`;
  }

  // 兜底：使用匿名标识
  return 'anonymous';
}

/**
 * 统一鉴权入口
 *
 * @param request - 请求对象
 * @returns 鉴权结果
 */
export async function authenticate(request: Request): Promise<AuthResult> {
  // 1. 提取 key（可选）
  const key = extractKey(request);

  // 2. 获取限流标识
  const rateLimitId = getRateLimitId(request, key);

  // 3. 限流检查（任何场景下都有效）
  const fallbackPermission = await getFallbackPermissionLevel();
  const rateLimitResult = checkRateLimit({
    subjectId: rateLimitId,
    permissionLevel: fallbackPermission,
  });

  if (!rateLimitResult.allowed) {
    logError('[Auth] 鉴权失败: 触发限流', { rateLimitId });
    return {
      success: false,
      error: rateLimitResult.reason || 'Rate limited',
      errorCode: 'RATE_LIMITED',
    };
  }

  // 4. 检查认证服务是否可用
  const authAvailable = await isAuthServiceAvailable();

  // 5. 认证服务不可用 → 跳过所有校验，返回默认权限
  if (!authAvailable) {
    logInfo('[Auth] 认证服务不可用，使用默认权限', {
      rateLimitId,
      permissionLevel: fallbackPermission,
    });

    return {
      success: true,
      key: key || undefined,
      permissionLevel: fallbackPermission,
      source: 'offline-fallback',
    };
  }

  // 6. 认证服务可用 → 格式校验
  if (!key) {
    logWarn('[Auth] key 缺失，使用默认权限');
    return {
      success: true,
      permissionLevel: fallbackPermission,
      source: 'no-key',
    };
  }

  if (!isValidKeyFormat(key)) {
    logWarn('[Auth] key 格式无效，使用默认权限', {
      keyPreview: key.slice(0, 16) + '...',
    });
    return {
      success: true,
      permissionLevel: fallbackPermission,
      source: 'invalid-key-fallback',
    };
  }

  // 7. 调用认证服务获取权限等级
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
