/**
 * 认证服务客户端
 *
 * 负责调用认证服务的 key 验证接口。
 * 业务服务器不持有密钥，所有验证委托认证服务。
 *
 * 降级策略：
 * - 认证服务未配置 → 游客
 * - 认证服务离线/超时 → 游客
 * - key 无效 → 游客
 */

import { logInfo, logWarn, logError } from './logger';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || process.env.ACCOUNT_SERVICE_URL || '';
const REQUEST_TIMEOUT_MS = 3000;

export interface AuthVerifyResult {
  valid: boolean;
  identityId?: string;
  permissionLevel: number;
  source: 'auth-service' | 'offline-fallback' | 'invalid-key-fallback';
}

/**
 * 调用认证服务验证 key
 *
 * @param key - 客户端持有的访问密钥
 * @returns 验证结果，始终返回有效结果（降级为游客）
 */
export async function verifyKey(key: string): Promise<AuthVerifyResult> {
  // 认证服务未配置 → 游客
  if (!AUTH_SERVICE_URL) {
    logWarn('[AuthClient] 未配置认证服务地址，降级为游客');
    return { valid: true, permissionLevel: 1, source: 'offline-fallback' };
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

    // 认证服务离线或错误 → 游客
    if (!response.ok) {
      logWarn('[AuthClient] 认证服务返回非 200 状态，降级为游客', {
        status: response.status,
      });
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

    // key 无效 → 游客
    logInfo('[AuthClient] key 无效，降级为游客');
    return { valid: true, permissionLevel: 1, source: 'invalid-key-fallback' };
  } catch (error) {
    // 认证服务不可达 → 游客
    if (error instanceof Error && error.name === 'AbortError') {
      logWarn('[AuthClient] 认证服务请求超时，降级为游客');
    } else {
      logError('[AuthClient] 认证服务请求失败', error);
    }
    return { valid: true, permissionLevel: 1, source: 'offline-fallback' };
  }
}
