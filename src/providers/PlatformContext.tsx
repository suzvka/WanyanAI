'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { PlatformConfig } from '@/types/platform';

/**
 * PlatformContext 值类型
 */
export type PlatformContextValue = {
  /** 平台配置 */
  platformConfig: PlatformConfig;
  /** 外观配置 */
  appearance: PlatformConfig['appearance'];
  /** 功能开关 */
  featureFlags: PlatformConfig['featureFlags'];
  /** 平台版本信息 */
  manifest: PlatformConfig['manifest'];
};

const PlatformContext = createContext<PlatformContextValue | null>(null);

export function usePlatformContext(): PlatformContextValue {
  const context = useContext(PlatformContext);
  if (!context) {
    throw new Error('usePlatformContext must be used within a PlatformProvider');
  }
  return context;
}

export type PlatformProviderProps = {
  children: ReactNode;
  platformConfig: PlatformConfig;
};

export function PlatformProvider({
  children,
  platformConfig,
}: PlatformProviderProps) {
  const value = useMemo<PlatformContextValue>(() => ({
    platformConfig,
    appearance: platformConfig.appearance,
    featureFlags: platformConfig.featureFlags,
    manifest: platformConfig.manifest,
  }), [platformConfig]);

  return (
    <PlatformContext.Provider value={value}>
      {children}
    </PlatformContext.Provider>
  );
}
