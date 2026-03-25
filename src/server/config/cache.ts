import 'server-only';

import { PublishedOpsConfig } from './types';

const CONFIG_CACHE_TTL_MS = process.env.NODE_ENV === 'development' ? 0 : 5000;

type CacheEntry = {
  value: PublishedOpsConfig;
  expiresAt: number;
};

let cacheEntry: CacheEntry | null = null;

export function getCachedOpsConfig(): PublishedOpsConfig | null {
  if (CONFIG_CACHE_TTL_MS <= 0 || cacheEntry === null) {
    return null;
  }

  if (Date.now() > cacheEntry.expiresAt) {
    cacheEntry = null;
    return null;
  }

  return cacheEntry.value;
}

export function setCachedOpsConfig(value: PublishedOpsConfig) {
  if (CONFIG_CACHE_TTL_MS <= 0) {
    return value;
  }

  cacheEntry = {
    value,
    expiresAt: Date.now() + CONFIG_CACHE_TTL_MS,
  };

  return value;
}

export function clearCachedOpsConfig() {
  cacheEntry = null;
}
