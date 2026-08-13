/**
 * 权限查询服务客户端
 *
 * 核心逻辑：
 * 1. 优先使用鉴权中心（AUTH_CENTER_URL）进行 Token 校验
 * 2. 兼容旧版权限查询服务（AUTH_SERVICE_URL）
 * 3. 定期探活检查权限查询服务可用性
 * 4. 只有权限查询服务可用时才进行权限等级查询
 * 5. 权限查询服务不可用时返回 fallback 权限
 *
 * 注意：此模块使用动态导入加载配置，避免循环依赖
 */

import { logInfo, logWarn, logError } from './logger';
import { verifyAuthResponse } from './authPlugins';
import { getPermissionLevelFromClaims } from '@/lib/auth-center/types';

export interface PermissionQueryResult {
  identityId?: string;
  permissionLevel: number;
  source: 'permission-service' | 'auth-center' | 'offline-fallback' | 'invalid-key-fallback' | 'no-key';
  /** 认证服务器返回的额外字段（原样透传给 auth-verifiers） */
  authPayload?: Record<string, unknown> | null;
}

// ============ 鉴权中心模式 ============

interface AuthCenterState {
  mode: 'auth-center';
  url: string;
  apiKey: string;
  verifyTimeoutMs: number;
  fallbackPermissionLevel: number;
  enableHealthCheck: boolean;
  healthCheckTimeoutMs: number;
  isAvailable: boolean;
  lastHealthCheckTime: number;
  healthCheckIntervalMs: number;
}

// ============ 旧版模式 ============

interface LegacyServiceState {
  mode: 'legacy';
  url: string;
  verifyTimeoutMs: number;
  fallbackPermissionLevel: number;
  enableHealthCheck: boolean;
  healthCheckTimeoutMs: number;
  isAvailable: boolean;
  lastHealthCheckTime: number;
  healthCheckIntervalMs: number;
}

type PermissionServiceState = AuthCenterState | LegacyServiceState;

// 全局状态（单例）
let state: PermissionServiceState | null = null;

// ============ 初始化 ============

async function initializeState(): Promise<PermissionServiceState> {
  if (state) return state;

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
  } catch {
    logWarn('[PermissionClient] 无法加载权限查询服务配置，使用环境变量');
  }

  const authCenterUrl = process.env.AUTH_CENTER_URL;
  const authCenterApiKey = process.env.AUTH_CENTER_API_KEY;
  const legacyUrl = config.url || process.env.AUTH_SERVICE_URL || process.env.ACCOUNT_SERVICE_URL || null;

  // 优先使用鉴权中心
  if (authCenterUrl && authCenterApiKey) {
    state = {
      mode: 'auth-center',
      url: authCenterUrl.replace(/\/$/, ''),
      apiKey: authCenterApiKey,
      verifyTimeoutMs: config.verifyTimeoutMs ?? 5000,
      fallbackPermissionLevel: config.fallbackPermissionLevel ?? 1,
      enableHealthCheck: config.enableHealthCheck ?? true,
      healthCheckTimeoutMs: config.healthCheckTimeoutMs ?? 3000,
      isAvailable: false,
      lastHealthCheckTime: 0,
      healthCheckIntervalMs: config.healthCheckIntervalMs ?? 30000,
    };

    if (state.enableHealthCheck) {
      await performHealthCheck();
    }
    return state;
  }

  // 兼容旧版
  if (legacyUrl) {
    state = {
      mode: 'legacy',
      url: legacyUrl.replace(/\/$/, ''),
      verifyTimeoutMs: config.verifyTimeoutMs ?? 5000,
      fallbackPermissionLevel: config.fallbackPermissionLevel ?? 1,
      enableHealthCheck: config.enableHealthCheck ?? true,
      healthCheckTimeoutMs: config.healthCheckTimeoutMs ?? 3000,
      isAvailable: false,
      lastHealthCheckTime: 0,
      healthCheckIntervalMs: config.healthCheckIntervalMs ?? 30000,
    };

    if (state.enableHealthCheck) {
      await performHealthCheck();
    }
    return state;
  }

  // 无配置：用空 legacy 模式
  state = {
    mode: 'legacy',
    url: '',
    verifyTimeoutMs: 5000,
    fallbackPermissionLevel: 1,
    enableHealthCheck: false,
    healthCheckTimeoutMs: 3000,
    isAvailable: false,
    lastHealthCheckTime: 0,
    healthCheckIntervalMs: 30000,
  };

  logWarn('[PermissionClient] 未配置任何权限查询服务地址');
  return state;
}

// ============ 探活 ============

async function performHealthCheck(): Promise<boolean> {
  if (!state || !('url' in state) || !state.url) return false;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), state.healthCheckTimeoutMs);

    let healthUrl: string;
    let headers: Record<string, string> = {};

    if (state.mode === 'auth-center') {
      healthUrl = `${state.url}/api/healthz`;
    } else {
      healthUrl = `${state.url}/api/auth/health`;
    }

    const response = await fetch(healthUrl, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const isAvailable = response.ok;
    state.isAvailable = isAvailable;
    state.lastHealthCheckTime = Date.now();

    if (isAvailable) {
      logInfo(`[PermissionClient] 权限查询服务可用 (${state.mode})`);
    } else {
      logWarn(`[PermissionClient] 权限查询服务不可用 (${state.mode})`, { status: response.status });
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

async function checkAndRefreshAvailability(): Promise<boolean> {
  if (!state) await initializeState();

  if (!state!.url) return false;
  if (!state!.enableHealthCheck) return true;

  const now = Date.now();
  if (now - state!.lastHealthCheckTime >= state!.healthCheckIntervalMs) {
    return performHealthCheck();
  }

  return state!.isAvailable;
}

// ============ 公开 API ============

export async function isPermissionServiceAvailable(): Promise<boolean> {
  return checkAndRefreshAvailability();
}

export async function getFallbackPermissionLevel(): Promise<number> {
  if (!state) await initializeState();
  return state!.fallbackPermissionLevel;
}

// ============ 鉴权中心模式：Token 校验 ============

async function resolveViaAuthCenter(key: string): Promise<PermissionQueryResult> {
  const s = state as AuthCenterState;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), s.verifyTimeoutMs);

    const response = await fetch(`${s.url}/api/v1/token/introspect`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${s.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: key }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      logWarn('[PermissionClient] 鉴权中心返回非 200', { status: response.status });
      return {
        permissionLevel: s.fallbackPermissionLevel,
        source: 'offline-fallback',
      };
    }

    const data = await response.json();

    if (!data.active) {
      logInfo('[PermissionClient] Token 无效（鉴权中心返回 active=false）');
      return {
        permissionLevel: s.fallbackPermissionLevel,
        source: 'invalid-key-fallback',
      };
    }

    // 从 claims 中提取会员等级 → 权限等级
    const permissionLevel = getPermissionLevelFromClaims(data.claims);
    const identityId = data.userId;

    logInfo('[PermissionClient] Token 鉴权成功（鉴权中心）', {
      identityId,
      permissionLevel,
      membershipLevel: data.claims?.membershipLevel,
    });

    return {
      identityId,
      permissionLevel,
      source: 'auth-center',
      authPayload: data.claims ?? null,
    };
  } catch (error) {
    s.isAvailable = false;

    if (error instanceof Error && error.name === 'AbortError') {
      logWarn('[PermissionClient] 鉴权中心请求超时');
    } else {
      logError('[PermissionClient] 鉴权中心请求失败', error);
    }

    return {
      permissionLevel: s.fallbackPermissionLevel,
      source: 'offline-fallback',
    };
  }
}

// ============ 旧版模式：Key 校验 ============

async function resolveViaLegacy(key: string): Promise<PermissionQueryResult> {
  const s = state as LegacyServiceState;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), s.verifyTimeoutMs);

    const response = await fetch(`${s.url}/api/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      logWarn('[PermissionClient] 权限查询服务返回非 200', { status: response.status });
      return {
        permissionLevel: s.fallbackPermissionLevel,
        source: 'offline-fallback',
      };
    }

    const data = await response.json();

    if (typeof data.permissionLevel === 'number') {
      const { identityId: _id, permissionLevel: _pl, ...authPayload } = data;
      const payload = Object.keys(authPayload).length > 0 ? authPayload : null;

      const authVerified = verifyAuthResponse({
        key,
        permissionLevel: data.permissionLevel,
        identityId: data.identityId,
        authPayload: payload,
      });

      if (!authVerified) {
        logWarn('[PermissionClient] 鉴权响应验证未通过');
        return {
          permissionLevel: s.fallbackPermissionLevel,
          source: 'invalid-key-fallback',
        };
      }

      logInfo('[PermissionClient] key 权限查询成功（旧版）', {
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

    logInfo('[PermissionClient] key 无效（旧版）');
    return {
      permissionLevel: s.fallbackPermissionLevel,
      source: 'invalid-key-fallback',
    };
  } catch (error) {
    s.isAvailable = false;

    if (error instanceof Error && error.name === 'AbortError') {
      logWarn('[PermissionClient] 权限查询服务请求超时');
    } else {
      logError('[PermissionClient] 权限查询服务请求失败', error);
    }

    return {
      permissionLevel: s.fallbackPermissionLevel,
      source: 'offline-fallback',
    };
  }
}

// ============ 统一入口 ============

/**
 * 根据 key（token）查询对应的权限等级
 *
 * 优先使用鉴权中心（AUTH_CENTER_URL），兼容旧版权限查询服务。
 *
 * @param key - 客户端持有的访问凭证（token 或 API key）
 * @returns 权限查询结果
 */
export async function resolvePermission(key: string | null | undefined): Promise<PermissionQueryResult> {
  if (!state) await initializeState();

  // 无 key → fallback
  if (!key || key.trim() === '') {
    return {
      permissionLevel: state!.fallbackPermissionLevel,
      source: 'no-key',
    };
  }

  // 无 URL → fallback
  if (!state!.url) {
    logWarn('[PermissionClient] 未配置权限查询服务地址，使用 fallback 权限');
    return {
      permissionLevel: state!.fallbackPermissionLevel,
      source: 'offline-fallback',
    };
  }

  // 检查可用性
  const isAvailable = await checkAndRefreshAvailability();
  if (!isAvailable) {
    logWarn('[PermissionClient] 权限查询服务不可用，使用 fallback 权限');
    return {
      permissionLevel: state!.fallbackPermissionLevel,
      source: 'offline-fallback',
    };
  }

  // 按模式分发
  if (state!.mode === 'auth-center') {
    return resolveViaAuthCenter(key);
  }
  return resolveViaLegacy(key);
}

/**
 * 重置状态（用于测试）
 */
export function resetPermissionClientState(): void {
  state = null;
}