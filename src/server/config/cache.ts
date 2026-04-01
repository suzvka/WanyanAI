import 'server-only';

import type { PlatformConfig } from '@/types/platform';

const CONFIG_CACHE_TTL_MS = process.env.NODE_ENV === 'development' ? 0 : 5000;

type CacheEntry = {
  value: PlatformConfig;
  expiresAt: number;
};

let cacheEntry: CacheEntry | null = null;

export function getCachedPlatformConfig(): PlatformConfig | null {
  if (CONFIG_CACHE_TTL_MS <= 0 || cacheEntry === null) {
    return null;
  }

  if (Date.now() > cacheEntry.expiresAt) {
    cacheEntry = null;
    return null;
  }

  return cacheEntry.value;
}

export function setCachedPlatformConfig(value: PlatformConfig) {
  if (CONFIG_CACHE_TTL_MS <= 0) {
    return value;
  }

  cacheEntry = {
    value,
    expiresAt: Date.now() + CONFIG_CACHE_TTL_MS,
  };

  return value;
}

export function clearCachedPlatformConfig() {
  cacheEntry = null;
}
