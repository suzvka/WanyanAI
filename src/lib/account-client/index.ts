/**
 * 账户服务器客户端
 * 
 * 负责调用账户服务器的 token 验证接口，获取用户权限等级。
 */

import { logInfo, logWarn, logError } from '@/lib/api-station/logger';

const ACCOUNT_SERVICE_URL = process.env.ACCOUNT_SERVICE_URL || '';
const REQUEST_TIMEOUT_MS = 2000;

/**
 * token 验证结果
 */
export interface AccountVerifyResult {
  success: boolean;
  userId?: string;
  permissionLevel: number;
}

/**
 * 验证账户 token
 * 
 * @param token - 账户服务器签发的 token
 * @returns 验证结果，包含权限等级
 */
export async function verifyAccountToken(token: string): Promise<AccountVerifyResult> {
  if (!ACCOUNT_SERVICE_URL) {
    logWarn('[AccountClient] 未配置 ACCOUNT_SERVICE_URL，降级为游客');
    return { success: false, permissionLevel: 1 };
  }

  if (!token || token.trim() === '') {
    return { success: false, permissionLevel: 1 };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(`${ACCOUNT_SERVICE_URL}/api/account/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      logWarn('[AccountClient] 账户服务返回非 200 状态', {
        status: response.status,
        statusText: response.statusText,
      });
      return { success: false, permissionLevel: 1 };
    }

    const data = await response.json();

    if (data.success && typeof data.permissionLevel === 'number') {
      logInfo('[AccountClient] 账户 token 验证成功', {
        userId: data.userId,
        permissionLevel: data.permissionLevel,
      });
      return {
        success: true,
        userId: data.userId,
        permissionLevel: data.permissionLevel,
      };
    }

    logInfo('[AccountClient] 账户 token 验证失败，降级为游客', {
      error: data.error,
    });
    return { success: false, permissionLevel: 1 };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      logWarn('[AccountClient] 账户服务请求超时，降级为游客');
    } else {
      logError('[AccountClient] 账户服务请求失败', error);
    }
    return { success: false, permissionLevel: 1 };
  }
}
