import 'server-only';

import type { PlatformConfig } from '@/types/platform';

/**
 * 创建 fallback 平台配置
 */
export function createFallbackPlatformConfig(): PlatformConfig {
  return {
    source: 'fallback',
    manifest: {
      configVersion: 'fallback',
      publishedAt: new Date(0).toISOString(),
      publishedBy: 'system',
      environment: 'local',
    },
    appearance: {
      brand: {
        name: 'AudienceAI',
        slogan: 'AI 驱动的文本诊断专家',
        fontFamily: 'var(--font-serif)',
      },
      theme: {
        primary: '#2e2e2e',
        backgroundOpacity: {
          light: 0.08,
          dark: 0.15,
        },
        brandColorOffset: {
          light: -0.15,
          dark: 0.1,
        },
      },
    },
    featureFlags: {
      enableFileUpload: true,
      enableAnnotations: true,
    },
  };
}
