import 'server-only';

import { getCachedPlatformConfig, setCachedPlatformConfig } from './cache';
import { createFallbackPlatformConfig } from './fallback';
import { loadPublishedPlatformConfig } from '@/server/platform-config';

/**
 * 获取平台配置
 */
export async function getPlatformConfig() {
  const cached = getCachedPlatformConfig();
  if (cached) {
    return cached;
  }

  try {
    const config = await loadPublishedPlatformConfig();

    return setCachedPlatformConfig(config);
  } catch {
    return setCachedPlatformConfig(createFallbackPlatformConfig());
  }
}
