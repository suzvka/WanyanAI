'use client';

import type { ReactNode } from 'react';
import AppSidebar from '@/components/layout/AppSidebar';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';

interface AppShellProps {
  siteTitle: string;
  primaryColor?: string;
  headerCenter?: ReactNode;
  headerActions?: ReactNode;
  children: ReactNode;
}

export default function AppShell({
  siteTitle,
  primaryColor,
  headerCenter,
  headerActions,
  children,
}: AppShellProps) {
  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar title={siteTitle} primaryColor={primaryColor} />
      <SidebarInset className="min-h-screen bg-transparent">
        <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="mx-auto max-w-7xl px-2.5 py-2 sm:px-6 lg:px-8">
            <div className="flex min-h-12 items-center gap-2 sm:gap-3">
              <div className="flex shrink-0 items-center">
                <SidebarTrigger aria-label="切换侧栏" className="size-9" />
              </div>
              {headerCenter ? <div className="min-w-0 flex-1">{headerCenter}</div> : <div className="flex-1" />}
              {headerActions ? <div className="flex shrink-0 items-center gap-2">{headerActions}</div> : null}
            </div>
          </div>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
