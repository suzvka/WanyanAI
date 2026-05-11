/**
 * 认证服务客户端
 *
 * 核心逻辑：
 * 1. 从配置加载认证服务地址和参数
 * 2. 定期探活检查认证服务可用性
 * 3. 只有认证服务可用时才进行权限校验
 * 4. 认证服务不可用时返回 fallback 权限
 *
 * 注意：此模块使用动态导入加载配置，避免循环依赖
 */

import { logInfo, logWarn, logError } from './logger';

export interface AuthVerifyResult {
  valid: boolean;
  identityId?: string;
  permissionLevel: number;
  source: 'auth-service' | 'offline-fallback' | 'invalid-key-fallback' | 'no-key';
}

interface AuthServiceState {
  url: string | null;
  verifyTimeoutMs: number;
  fallbackPermissionLevel: number;
  enableHealthCheck: boolean;
  healthCheckTimeoutMs: number;
  /** 认证服务是否可用 */
  isAvailable: boolean;
  /** 上次探活时间 */
  lastHealthCheckTime: number;
  /** 探活检查间隔 */
  healthCheckIntervalMs: number;
}

// 全局状态（单例）
let state: AuthServiceState | null = null;

/**
 * 初始化认证服务状态
 */
async function initializeState(): Promise<AuthServiceState> {
  if (state) {
    return state;
  }

  // 动态导入配置，避免循环依赖
  let config: {
    url?: string;
    verifyTimeoutMs?: number;
    fallbackPermissionLevel?: number;
    enableHealthCheck?: boolean;
    healthCheckTimeoutMs?: number;
    healthCheckIntervalMs?: number;
  } = {};

  try {
    const { loadAuthServiceConfig } = await import('@/server/platform-config/loader');
    config = loadAuthServiceConfig();
  } catch (error) {
    logWarn('[AuthClient] 无法加载认证服务配置，使用环境变量');
  }

  const url = config.url || process.env.AUTH_SERVICE_URL || process.env.ACCOUNT_SERVICE_URL || null;

  state = {
    url,
    verifyTimeoutMs: config.verifyTimeoutMs ?? 5000,
    fallbackPermissionLevel: config.fallbackPermissionLevel ?? 1,
    enableHealthCheck: config.enableHealthCheck ?? true,
    healthCheckTimeoutMs: config.healthCheckTimeoutMs ?? 3000,
    isAvailable: false, // 初始状态，需要探活确认
    lastHealthCheckTime: 0,
    healthCheckIntervalMs: config.healthCheckIntervalMs ?? 30000,
  };

  // 如果有 URL 且启用探活，立即执行一次探活
  if (state.url && state.enableHealthCheck) {
    await performHealthCheck();
  } else if (!state.url) {
    logWarn('[AuthClient] 未配置认证服务地址');
  }

  return state;
}

/**
 * 探活检查认证服务是否可用
 */
async function performHealthCheck(): Promise<boolean> {
  if (!state || !state.url) {
    return false;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), state.healthCheckTimeoutMs);

    // 尝试访问认证服务的健康检查端点
    const healthUrl = `${state.url}/api/auth/health`;
    const response = await fetch(healthUrl, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const isAvailable = response.ok;
    state.isAvailable = isAvailable;
    state.lastHealthCheckTime = Date.now();

    if (isAvailable) {
      logInfo('[AuthClient] 认证服务可用');
    } else {
      logWarn('[AuthClient] 认证服务不可用', { status: response.status });
    }

    return isAvailable;
  } catch (error) {
    state.isAvailable = false;
    state.lastHealthCheckTime = Date.now();

    if (error instanceof Error && error.name === 'AbortError') {
      logWarn('[AuthClient] 认证服务探活超时');
    } else {
      logWarn('[AuthClient] 认证服务探活失败', { error: String(error) });
    }

    return false;
  }
}

/**
 * 检查是否需要执行探活
 */
async function checkAndRefreshAvailability(): Promise<boolean> {
  if (!state) {
    await initializeState();
  }

  if (!state!.url) {
    return false;
  }

  // 未启用探活检查，默认认为可用
  if (!state!.enableHealthCheck) {
    return true;
  }

  const now = Date.now();
  const timeSinceLastCheck = now - state!.lastHealthCheckTime;

  // 超过检查间隔，重新探活
  if (timeSinceLastCheck >= state!.healthCheckIntervalMs) {
    return performHealthCheck();
  }

  return state!.isAvailable;
}

/**
 * 检查认证服务是否可用
 */
export async function isAuthServiceAvailable(): Promise<boolean> {
  return checkAndRefreshAvailability();
}

/**
 * 获取 fallback 权限等级
 */
export async function getFallbackPermissionLevel(): Promise<number> {
  if (!state) {
    await initializeState();
  }
  return state!.fallbackPermissionLevel;
}

/**
 * 调用认证服务验证 key
 *
 * @param key - 客户端持有的访问密钥
 * @returns 验证结果
 */
export async function verifyKey(key: string | null | undefined): Promise<AuthVerifyResult> {
  // 初始化状态
  if (!state) {
    await initializeState();
  }

  // 无 key → 使用 fallback
  if (!key || key.trim() === '') {
    return {
      valid: true,
      permissionLevel: state!.fallbackPermissionLevel,
      source: 'no-key',
    };
  }

  // 无认证服务地址 → 使用 fallback
  if (!state!.url) {
    logWarn('[AuthClient] 未配置认证服务地址，使用 fallback 权限');
    return {
      valid: true,
      permissionLevel: state!.fallbackPermissionLevel,
      source: 'offline-fallback',
    };
  }

  // 检查认证服务可用性
  const isAvailable = await checkAndRefreshAvailability();

  // 认证服务不可用 → 使用 fallback
  if (!isAvailable) {
    logWarn('[AuthClient] 认证服务不可用，使用 fallback 权限');
    return {
      valid: true,
      permissionLevel: state!.fallbackPermissionLevel,
      source: 'offline-fallback',
    };
  }

  // 认证服务可用，进行权限校验
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), state!.verifyTimeoutMs);

    const response = await fetch(`${state!.url}/api/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      logWarn('[AuthClient] 认证服务返回非 200 状态，使用 fallback 权限', {
        status: response.status,
      });
      return {
        valid: true,
        permissionLevel: state!.fallbackPermissionLevel,
        source: 'offline-fallback',
      };
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

    // key 无效 → 使用 fallback
    logInfo('[AuthClient] key 无效，使用 fallback 权限');
    return {
      valid: true,
      permissionLevel: state!.fallbackPermissionLevel,
      source: 'invalid-key-fallback',
    };
  } catch (error) {
    // 请求失败，标记服务不可用
    state!.isAvailable = false;

    if (error instanceof Error && error.name === 'AbortError') {
      logWarn('[AuthClient] 认证服务请求超时，使用 fallback 权限');
    } else {
      logError('[AuthClient] 认证服务请求失败', error);
    }

    return {
      valid: true,
      permissionLevel: state!.fallbackPermissionLevel,
      source: 'offline-fallback',
    };
  }
}

/**
 * 重置状态（用于测试）
 */
export function resetAuthClientState(): void {
  state = null;
}
