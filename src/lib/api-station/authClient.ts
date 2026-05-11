/**
 * 认证服务客户端
 *
 * 负责调用认证服务的 key 验证接口。
 * 业务服务器不持有密钥，所有验证委托认证服务。
 *
 * 降级策略（静默）：
 * - 认证服务未配置 → 游客
 * - 认证服务离线/超时 → 游客
 * - key 无效 → 游客
 */

import { logInfo, logError } from './logger';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || process.env.ACCOUNT_SERVICE_URL || '';
const REQUEST_TIMEOUT_MS = 3000;

export interface AuthVerifyResult {
  valid: boolean;
  identityId?: string;
  permissionLevel: number;
  source: 'auth-service' | 'offline-fallback' | 'invalid-key-fallback' | 'no-auth-service';
}

/**
 * 调用认证服务验证 key
 *
 * @param key - 客户端持有的访问密钥
 * @returns 验证结果，始终返回有效结果（降级为游客）
 */
export async function verifyKey(key: string): Promise<AuthVerifyResult> {
  // 认证服务未配置 → 游客（静默）
  if (!AUTH_SERVICE_URL) {
    return { valid: true, permissionLevel: 1, source: 'no-auth-service' };
  }

  // key 为空 → 游客
  if (!key || key.trim() === '') {
    return { valid: true, permissionLevel: 1, source: 'invalid-key-fallback' };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(`${AUTH_SERVICE_URL}/api/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // 认证服务离线或错误 → 游客（静默）
    if (!response.ok) {
      return { valid: true, permissionLevel: 1, source: 'offline-fallback' };
    }

    const data = await response.json();

    if (data.valid && typeof data.permissionLevel === 'number') {
      logInfo('[AuthClient] key 验证成功', {
        identityId: data.identityId,
        permissionLevel: data.permissionLevel,
      });
      return {
        valid: true,
        identityId: data.identityId,
        permissionLevel: data.permissionLevel,
        source: 'auth-service',
      };
    }

    // key 无效 → 游客（静默）
    return { valid: true, permissionLevel: 1, source: 'invalid-key-fallback' };
  } catch {
    // 认证服务不可达 → 游客（静默）
    return { valid: true, permissionLevel: 1, source: 'offline-fallback' };
  }
}
