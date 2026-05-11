/**
 * 内置 API 配置
 * 提供站内模型服务的配置信息
 */

import { requestJson } from '@/lib/client-request';
import type { ModelInfo, ApiConfigValidationStatus } from '@/types/modelConfig';
import { isValidKeyFormat } from './keyFormat';

const USER_REF_KEY = 'built_in_user_ref';
const BUILT_IN_PROXY_KEY = 'built_in_proxy_key';
const BUILT_IN_PROXY_KEY_EXPIRES = 'built_in_proxy_key_expires';
const BUILT_IN_CACHE_KEY = 'built_in_models_cache';

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

    if (!isValidKeyFormat(key)) {
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

export async function refreshBuiltInApiKey(): Promise<BuiltInProxyKeyInfo> {
  const userRefHint = getBuiltInUserRef();
  const payload = await requestJson<{
    key?: string;
    expiresAt?: number;
    error?: { message?: string };
  }>(`${getBuiltInBaseUrl()}/key`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userRef: userRefHint }),
    errorMessage: '站内代理 Key 获取失败',
    networkErrorMessage: '站内代理 Key 获取失败，请检查网络连接后重试',
  });

  if (!payload?.key || typeof payload.expiresAt !== 'number') {
    throw new Error(payload?.error?.message || '站内代理 Key 获取失败');
  }

  const keyInfo = {
    key: payload.key,
    expiresAt: payload.expiresAt,
  };
  saveBuiltInApiKey(keyInfo);
  return keyInfo;
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
