/**
 * 权限查询服务客户端
 *
 * 核心逻辑：
 * 1. 从配置加载权限查询服务地址和参数
 * 2. 定期探活检查权限查询服务可用性
 * 3. 只有权限查询服务可用时才进行权限等级查询
 * 4. 权限查询服务不可用时返回 fallback 权限
 *
 * 注意：此模块使用动态导入加载配置，避免循环依赖
 */

import { logInfo, logWarn, logError } from './logger';
import { verifyAuthResponse } from './authPlugins';

export interface PermissionQueryResult {
  identityId?: string;
  permissionLevel: number;
  source: 'permission-service' | 'offline-fallback' | 'invalid-key-fallback' | 'no-key';
  /** 认证服务器返回的额外字段（原样透传给 auth-verifiers） */
  authPayload?: Record<string, unknown> | null;
}

interface PermissionServiceState {
  url: string | null;
  verifyTimeoutMs: number;
  fallbackPermissionLevel: number;
  enableHealthCheck: boolean;
  healthCheckTimeoutMs: number;
  /** 权限查询服务是否可用 */
  isAvailable: boolean;
  /** 上次探活时间 */
  lastHealthCheckTime: number;
  /** 探活检查间隔 */
  healthCheckIntervalMs: number;
}

// 全局状态（单例）
let state: PermissionServiceState | null = null;

/**
 * 初始化权限查询服务状态
 */
async function initializeState(): Promise<PermissionServiceState> {
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
    const { loadPermissionServiceConfig } = await import('@/server/platform-config/loader');
    config = loadPermissionServiceConfig();
  } catch (error) {
    logWarn('[PermissionClient] 无法加载权限查询服务配置，使用环境变量');
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
    logWarn('[PermissionClient] 未配置权限查询服务地址');
  }

  return state;
}

/**
 * 探活检查权限查询服务是否可用
 */
async function performHealthCheck(): Promise<boolean> {
  if (!state || !state.url) {
    return false;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), state.healthCheckTimeoutMs);

    // 尝试访问权限查询服务的健康检查端点
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
      logInfo('[PermissionClient] 权限查询服务可用');
    } else {
      logWarn('[PermissionClient] 权限查询服务不可用', { status: response.status });
    }

    return isAvailable;
  } catch (error) {
    state.isAvailable = false;
    state.lastHealthCheckTime = Date.now();

    if (error instanceof Error && error.name === 'AbortError') {
      logWarn('[PermissionClient] 权限查询服务探活超时');
    } else {
      logWarn('[PermissionClient] 权限查询服务探活失败', { error: String(error) });
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
 * 检查权限查询服务是否可用
 */
export async function isPermissionServiceAvailable(): Promise<boolean> {
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
 * 根据 key 查询对应的权限等级
 *
 * key 由客户端通过 Authorization 头传入，本模块仅负责询问外部服务
 * "这个 key 对应的权限等级是多少"，实际的身份认证（登录、用户身份验证等）
 * 由外部服务（商业认证业务）完成。
 *
 * @param key - 客户端持有的访问密钥
 * @returns 权限查询结果（始终有效，无效 key 降级为 fallback 权限）
 */
export async function resolvePermission(key: string | null | undefined): Promise<PermissionQueryResult> {
  // 初始化状态
  if (!state) {
    await initializeState();
  }

  // 无 key → 使用 fallback
  if (!key || key.trim() === '') {
    return {
      permissionLevel: state!.fallbackPermissionLevel,
      source: 'no-key',
    };
  }

  // 无权限查询服务地址 → 使用 fallback
  if (!state!.url) {
    logWarn('[PermissionClient] 未配置权限查询服务地址，使用 fallback 权限');
    return {
      permissionLevel: state!.fallbackPermissionLevel,
      source: 'offline-fallback',
    };
  }

  // 检查权限查询服务可用性
  const isAvailable = await checkAndRefreshAvailability();

  // 权限查询服务不可用 → 使用 fallback
  if (!isAvailable) {
    logWarn('[PermissionClient] 权限查询服务不可用，使用 fallback 权限');
    return {
      permissionLevel: state!.fallbackPermissionLevel,
      source: 'offline-fallback',
    };
  }

  // 权限查询服务可用，查询权限等级
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
      logWarn('[PermissionClient] 权限查询服务返回非 200 状态，使用 fallback 权限', {
        status: response.status,
      });
      return {
        permissionLevel: state!.fallbackPermissionLevel,
        source: 'offline-fallback',
      };
    }

    const data = await response.json();

    if (typeof data.permissionLevel === 'number') {
      // 提取业务核心字段之外的额外数据，原样透传给验证器
      const { identityId: _id, permissionLevel: _pl, ...authPayload } = data;
      const payload = Object.keys(authPayload).length > 0 ? authPayload : null;

      // 执行鉴权响应验证器（auth-verifiers/）
      const authVerified = verifyAuthResponse({
        key,
        permissionLevel: data.permissionLevel,
        identityId: data.identityId,
        authPayload: payload,
      });

      if (!authVerified) {
        logWarn('[PermissionClient] 鉴权响应验证未通过，使用 fallback 权限');
        return {
          permissionLevel: state!.fallbackPermissionLevel,
          source: 'invalid-key-fallback',
        };
      }

      logInfo('[PermissionClient] key 权限查询成功', {
        identityId: data.identityId,
        permissionLevel: data.permissionLevel,
      });
      return {
        identityId: data.identityId,
        permissionLevel: data.permissionLevel,
        source: 'permission-service',
        authPayload: payload,
      };
    }

    // key 无效 → 使用 fallback
    logInfo('[PermissionClient] key 无效，使用 fallback 权限');
    return {
      permissionLevel: state!.fallbackPermissionLevel,
      source: 'invalid-key-fallback',
    };
  } catch (error) {
    // 请求失败，标记服务不可用
    state!.isAvailable = false;

    if (error instanceof Error && error.name === 'AbortError') {
      logWarn('[PermissionClient] 权限查询服务请求超时，使用 fallback 权限');
    } else {
      logError('[PermissionClient] 权限查询服务请求失败', error);
    }

    return {
      permissionLevel: state!.fallbackPermissionLevel,
      source: 'offline-fallback',
    };
  }
}

/**
 * 重置状态（用于测试）
 */
export function resetPermissionClientState(): void {
  state = null;
}
