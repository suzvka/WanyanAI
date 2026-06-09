'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import BrandBackground from '@/components/ui/brand-background';
import AppShell from '@/components/layout/AppShell';
import { NavigationGuardProvider } from '@/providers/NavigationGuardContext';
import { usePageFirstLoad } from '@/hooks/usePageFirstLoad';
import type { AppearanceConfig } from '@/server/config/types';

interface LandingClientProps {
  appearance: AppearanceConfig;
}

export default function LandingClient({ appearance }: LandingClientProps) {
  const { brand } = appearance;
  const pathname = usePathname();

  // 检测是否首次加载，只在首次显示骨架屏
  const isFirstLoad = usePageFirstLoad();

  // 页面过渡状态
  const [isPageVisible, setIsPageVisible] = useState(false);

  // 路由变化时触发页面过渡动画
  useEffect(() => {
    const hideTimer = setTimeout(() => setIsPageVisible(false), 0);
    const showTimer = setTimeout(() => setIsPageVisible(true), 50);
    return () => {
      clearTimeout(hideTimer);
      clearTimeout(showTimer);
    };
  }, [pathname]);

  // 首次加载动画
  useEffect(() => {
    if (!isFirstLoad) {
      const timer = setTimeout(() => setIsPageVisible(true), 50);
      return () => clearTimeout(timer);
    }
  }, [isFirstLoad]);

  // 首次加载时显示骨架屏
  if (isFirstLoad) {
    return (
      <div className="min-h-screen bg-background">
        <main className="flex min-h-[70vh] flex-col items-center justify-center px-4">
          <div className="h-14 w-64 animate-pulse rounded-md bg-accent mb-6" />
          <div className="h-5 w-80 animate-pulse rounded-md bg-accent mb-10" />
          <div className="h-12 w-40 animate-pulse rounded-full bg-accent" />
        </main>
      </div>
    );
  }

  return (
    <NavigationGuardProvider>
      <>
        <BrandBackground appearance={appearance} />

        <AppShell
          siteTitle={brand.name}
          primaryColor={appearance.theme.primary}
        >
        <main
          className="mx-auto flex w-full max-w-4xl flex-col items-center justify-center px-4 sm:px-6 lg:px-8"
          style={{
            minHeight: 'calc(100vh - 65px)',
            opacity: isPageVisible ? 1 : 0,
            transform: isPageVisible ? 'translateY(0)' : 'translateY(16px)',
            transition: `opacity var(--motion-duration-slow) var(--motion-ease-emphasized),
                         transform var(--motion-duration-slow) var(--motion-ease-emphasized)`,
          }}
        >
          {/* 品牌区域 */}
          <div className="text-center">
            <h1
              className="text-5xl font-bold tracking-tight text-foreground mb-4 sm:text-6xl"
              style={{ fontFamily: brand.fontFamily || 'var(--font-serif)' }}
            >
              {brand.name}
            </h1>
            {brand.slogan && (
              <p className="text-xl text-muted-foreground mb-12 sm:text-2xl">
                {brand.slogan}
              </p>
            )}
          </div>

          {/* CTA 按钮 */}
          <Link
            href="/modules"
            className="group inline-flex items-center gap-2 rounded-full bg-foreground px-8 py-3.5 text-base font-medium text-background transition-all hover:shadow-lg hover:opacity-90"
            style={{
              opacity: isPageVisible ? 1 : 0,
              transform: isPageVisible ? 'translateY(0)' : 'translateY(8px)',
              transition: `opacity var(--motion-duration-standard) var(--motion-ease-emphasized) 200ms,
                           transform var(--motion-duration-standard) var(--motion-ease-emphasized) 200ms,
                           box-shadow 200ms ease`,
            }}
          >
            <span>开始使用</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </main>
      </AppShell>
      </>
    </NavigationGuardProvider>
  );
}
