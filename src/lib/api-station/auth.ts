/**
 * 简化版鉴权模块
 *
 * 注意：鉴权已于 2026-05 上移至主入口 route.ts 统一处理。
 * 主系统在 chat completions 路由中调用 verifyKey（authClient.ts）和
 * checkRateLimit（rateLimit.ts），各子站不再自行鉴权限流。
 * extractKey 仍用于从请求头提取 key。
 * authenticate() 已废弃，不应再被调用。
 *
 * @deprecated 鉴权逻辑已迁移至 src/app/api/v1/chat/completions/route.ts
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
  /** authenticate 内部限流检查后返回的配额信息，调用方可直接用于响应头 */
  quota?: { limit: number; remaining: number; reset: number };
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
 * @deprecated 鉴权已上移至主入口 route.ts。请勿在主系统路由中调用此函数。
 *             限流使用 checkRateLimit（来自 rateLimit.ts），
 *             鉴权使用 verifyKey（来自 authClient.ts）。
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
      quota: rateLimitResult.quota,
    };
  }

  // 6. 认证服务可用 → 格式校验
  if (!key) {
    logWarn('[Auth] key 缺失，使用默认权限');
    return {
      success: true,
      permissionLevel: fallbackPermission,
      source: 'no-key',
      quota: rateLimitResult.quota,
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
      quota: rateLimitResult.quota,
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
    quota: rateLimitResult.quota,
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
