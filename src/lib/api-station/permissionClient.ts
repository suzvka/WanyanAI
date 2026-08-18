/**
 * 权限查询服务客户端
 *
 * 通过鉴权中心（Token Authority Service）进行 Token 校验。
 *
 * 流程：
 * 1. 客户端提交 token → 鉴权中心 introspect
 * 2. 从返回的 claims 中提取 membershipLevel → 映射为 permissionLevel
 * 3. 鉴权中心不可用时返回 fallback 权限
 */

import { logInfo, logWarn, logError } from './logger';
import { getPermissionLevelFromClaims } from '@/lib/auth-center/types';
import { loadEnv } from 'yunzone-service-kit/config';
import { envLoadOptions, envSchema } from '@/lib/env-schema';

export interface PermissionQueryResult {
  identityId?: string;
  permissionLevel: number;
  source: 'auth-center' | 'offline-fallback' | 'invalid-key-fallback' | 'no-key';
  /** 鉴权中心返回的 claims（原样透传） */
  authPayload?: Record<string, unknown> | null;
}

interface AuthCenterState {
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

let state: AuthCenterState | null = null;

// ============ 初始化 ============

async function initializeState(): Promise<AuthCenterState> {
  if (state) return state;

  const env = loadEnv(envSchema, envLoadOptions);
  const authCenterUrl = env.AUTH_CENTER_URL;
  const authCenterApiKey = env.AUTH_CENTER_API_KEY;

  let config: {
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
    logWarn('[PermissionClient] 无法加载权限查询服务配置，使用默认值');
  }

  if (!authCenterUrl) {
    logWarn('[PermissionClient] 未配置 AUTH_CENTER_URL，无鉴权中心可用');
    state = {
      url: '',
      apiKey: '',
      verifyTimeoutMs: config.verifyTimeoutMs ?? 5000,
      fallbackPermissionLevel: config.fallbackPermissionLevel ?? 1,
      enableHealthCheck: false,
      healthCheckTimeoutMs: config.healthCheckTimeoutMs ?? 3000,
      isAvailable: false,
      lastHealthCheckTime: 0,
      healthCheckIntervalMs: config.healthCheckIntervalMs ?? 30000,
    };
    return state;
  }

  state = {
    url: authCenterUrl.replace(/\/$/, ''),
    apiKey: authCenterApiKey || '',
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

// ============ 探活 ============

async function performHealthCheck(): Promise<boolean> {
  if (!state || !state.url) return false;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), state.healthCheckTimeoutMs);

    const response = await fetch(`${state.url}/api/healthz`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    state.isAvailable = response.ok;
    state.lastHealthCheckTime = Date.now();

    if (response.ok) {
      logInfo('[PermissionClient] 鉴权中心可用');
    } else {
      logWarn('[PermissionClient] 鉴权中心不可用', { status: response.status });
    }

    return response.ok;
  } catch (error) {
    state.isAvailable = false;
    state.lastHealthCheckTime = Date.now();

    if (error instanceof Error && error.name === 'AbortError') {
      logWarn('[PermissionClient] 鉴权中心探活超时');
    } else {
      logWarn('[PermissionClient] 鉴权中心探活失败', { error: String(error) });
    }

    return false;
  }
}

async function getState(): Promise<AuthCenterState> {
  if (!state) await initializeState();
  return state!;
}

async function checkAndRefreshAvailability(): Promise<boolean> {
  const s = await getState();

  if (!s.url) return false;
  if (!s.enableHealthCheck) return true;

  const now = Date.now();
  if (now - s.lastHealthCheckTime >= s.healthCheckIntervalMs) {
    return performHealthCheck();
  }

  return s.isAvailable;
}

// ============ 公开 API ============

export async function isPermissionServiceAvailable(): Promise<boolean> {
  return checkAndRefreshAvailability();
}

export async function getFallbackPermissionLevel(): Promise<number> {
  const s = await getState();
  return s.fallbackPermissionLevel;
}

// ============ Token 校验 ============

async function resolveViaAuthCenter(key: string, s: AuthCenterState): Promise<PermissionQueryResult> {

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

    const permissionLevel = getPermissionLevelFromClaims(data.claims);
    const identityId = data.userId;

    logInfo('[PermissionClient] Token 鉴权成功', {
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

// ============ 统一入口 ============

/**
 * 根据 token 查询对应的权限等级
 *
 * 通过鉴权中心 introspect API 校验 token，从 claims 中提取会员等级。
 *
 * @param key - 客户端持有的访问凭证（station token）
 * @returns 权限查询结果
 */
export async function resolvePermission(key: string | null | undefined): Promise<PermissionQueryResult> {
  const s = await getState();

  if (!key || key.trim() === '') {
    return {
      permissionLevel: s.fallbackPermissionLevel,
      source: 'no-key',
    };
  }

  if (!s.url) {
    logWarn('[PermissionClient] 未配置鉴权中心地址，使用 fallback 权限');
    return {
      permissionLevel: s.fallbackPermissionLevel,
      source: 'offline-fallback',
    };
  }

  const isAvailable = await checkAndRefreshAvailability();
  if (!isAvailable) {
    logWarn('[PermissionClient] 鉴权中心不可用，使用 fallback 权限');
    return {
      permissionLevel: s.fallbackPermissionLevel,
      source: 'offline-fallback',
    };
  }

  return resolveViaAuthCenter(key, s);
}

/**
 * 重置状态（用于测试）
 */
export function resetPermissionClientState(): void {
  state = null;
}