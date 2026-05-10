'use client';

import type { ReactNode } from 'react';
import BrandBackground from '@/components/ui/brand-background';
import AppShell from '@/components/layout/AppShell';
import { NavigationGuardProvider } from '@/providers/NavigationGuardContext';
import type { PageModulePublicMeta } from '@/types/module';
import type { PlatformConfig } from '@/types/platform';

interface HistoryAppShellProps {
  platformConfig: PlatformConfig;
  modules: PageModulePublicMeta[];
  children: ReactNode;
}

export default function HistoryAppShell({
  platformConfig,
  modules,
  children,
}: HistoryAppShellProps) {
  return (
    <NavigationGuardProvider>
      <BrandBackground appearance={platformConfig.appearance} />
      <AppShell
        siteTitle={platformConfig.appearance.brand.name}
        primaryColor={platformConfig.appearance.theme.primary}
        modules={modules}
      >
        {children}
      </AppShell>
    </NavigationGuardProvider>
  );
}
