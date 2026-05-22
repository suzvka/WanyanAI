/**
 * 内置 API 配置
 * 提供站内模型服务的配置信息
 */

import type { ModelInfo, ApiConfigValidationStatus } from '@/types/modelConfig';

const USER_REF_KEY = 'built_in_user_ref';
const BUILT_IN_PROXY_KEY = 'built_in_proxy_key';
const BUILT_IN_PROXY_KEY_EXPIRES = 'built_in_proxy_key_expires';
const BUILT_IN_CACHE_KEY = 'built_in_models_cache';

// 本地 key 有效期：30 分钟
const LOCAL_KEY_TTL_MS = 30 * 60 * 1000;

interface BuiltInModelsCache {
  models: ModelInfo[];
  validationStatus: ApiConfigValidationStatus;
  selectedModel: string | null;
  cachedAt: string;
}

interface BuiltInProxyKeyInfo {
  key: string;
  expiresAt: number;
}

/**
 * 生成本地 key
 * 格式：local_<timestamp>_<random>
 */
function generateLocalKey(): string {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function generateUserRef(): string {
  return crypto.randomUUID();
}

export function getBuiltInUserRef(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  let userRef = localStorage.getItem(USER_REF_KEY);
  if (!userRef) {
    userRef = generateUserRef();
    localStorage.setItem(USER_REF_KEY, userRef);
  }

  return userRef;
}

export function getBuiltInBaseUrl(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  return `${window.location.origin}/api/v1`;
}

export const BUILT_IN_CONFIG_NAME = '站内模型服务';

export function getBuiltInApiKey(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    const key = localStorage.getItem(BUILT_IN_PROXY_KEY);
    const expiresAtStr = localStorage.getItem(BUILT_IN_PROXY_KEY_EXPIRES);

    if (!key || !expiresAtStr) {
      return '';
    }

    const expiresAt = parseInt(expiresAtStr, 10);
    if (Date.now() >= expiresAt) {
      clearBuiltInApiKey();
      return '';
    }

    return key;
  } catch {
    clearBuiltInApiKey();
    return '';
  }
}

export function clearBuiltInApiKey(): void {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.removeItem(BUILT_IN_PROXY_KEY);
  localStorage.removeItem(BUILT_IN_PROXY_KEY_EXPIRES);
}

function saveBuiltInApiKey(info: BuiltInProxyKeyInfo) {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.setItem(BUILT_IN_PROXY_KEY, info.key);
  localStorage.setItem(BUILT_IN_PROXY_KEY_EXPIRES, info.expiresAt.toString());
}

/**
 * 获取或刷新内置 API key
 *
 * 直接生成本地 key，无需请求外部权限查询服务。
 * 因为权限查询服务不可用时，任意 key 都能通过并获取默认权限。
 */
export function refreshBuiltInApiKey(): BuiltInProxyKeyInfo {
  const keyInfo: BuiltInProxyKeyInfo = {
    key: generateLocalKey(),
    expiresAt: Date.now() + LOCAL_KEY_TTL_MS,
  };

  saveBuiltInApiKey(keyInfo);
  return keyInfo;
}

/**
 * 确保有可用的 key
 *
 * 如果当前 key 有效则返回，否则生成新的
 */
export function ensureBuiltInApiKey(): string {
  const existingKey = getBuiltInApiKey();
  if (existingKey) {
    return existingKey;
  }

  const keyInfo = refreshBuiltInApiKey();
  return keyInfo.key;
}

export function getBuiltInModelsCache(): BuiltInModelsCache | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const cacheStr = localStorage.getItem(BUILT_IN_CACHE_KEY);
    if (!cacheStr) {
      return null;
    }
    return JSON.parse(cacheStr) as BuiltInModelsCache;
  } catch {
    return null;
  }
}

export function saveBuiltInModelsCache(
  models: ModelInfo[],
  validationStatus: ApiConfigValidationStatus,
  selectedModel: string | null
): void {
  if (typeof window === 'undefined') {
    return;
  }

  const cache: BuiltInModelsCache = {
    models,
    validationStatus,
    selectedModel,
    cachedAt: new Date().toISOString(),
  };

  localStorage.setItem(BUILT_IN_CACHE_KEY, JSON.stringify(cache));
}

export function clearBuiltInModelsCache(): void {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.removeItem(BUILT_IN_CACHE_KEY);
}
