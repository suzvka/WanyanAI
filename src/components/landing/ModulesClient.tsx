'use client';

import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowRight, BookOpen } from 'lucide-react';
import BrandBackground from '@/components/ui/brand-background';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AppShell from '@/components/layout/AppShell';
import { NavigationGuardProvider } from '@/providers/NavigationGuardContext';
import { usePageFirstLoad } from '@/hooks/usePageFirstLoad';
import type { PlatformConfig } from '@/types/platform';
import type { PageModulePublicMeta } from '@/types/module';

// 图标映射表
const ICON_MAP: Record<string, ComponentType<{ className?: string }>> = {
  BookOpen,
};

interface ModulesClientProps {
  platformConfig: PlatformConfig;
  modules: PageModulePublicMeta[];
}

function getModuleHref(slug: string): string {
  return `/evaluate/${slug}`;
}

export default function ModulesClient({ platformConfig, modules }: ModulesClientProps) {
  const { appearance } = platformConfig;
  const { brand } = appearance;
  const pathname = usePathname();
  const router = useRouter();
  const prefetchedRef = useRef(false);

  // 检测是否首次加载
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

  // === 静默预取次级页面 ===
  const prefetchModules = useCallback(() => {
    if (prefetchedRef.current) return;
    prefetchedRef.current = true;

    const prefetchAll = () => {
      for (const mod of modules) {
        router.prefetch(getModuleHref(mod.slug));
      }
    };

    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(prefetchAll, { timeout: 3000 });
    } else {
      setTimeout(prefetchAll, 1000);
    }
  }, [modules, router]);

  useEffect(() => {
    if (!isFirstLoad) {
      prefetchModules();
    }
  }, [isFirstLoad, prefetchModules]);

  if (isFirstLoad) {
    return (
      <div className="min-h-screen bg-background">
        <main className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="mb-8">
            <div className="h-8 w-32 animate-pulse rounded-md bg-accent" />
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 animate-pulse rounded-lg bg-accent" />
                  <div className="h-6 w-32 animate-pulse rounded-md bg-accent" />
                </div>
                <div className="h-4 w-full animate-pulse rounded-md bg-accent" />
                <div className="h-4 w-3/4 animate-pulse rounded-md bg-accent" />
              </div>
            ))}
          </div>
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
          className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 lg:px-8"
          style={{
            opacity: isPageVisible ? 1 : 0,
            transform: isPageVisible ? 'translateY(0)' : 'translateY(16px)',
            transition: `opacity var(--motion-duration-slow) var(--motion-ease-emphasized),
                         transform var(--motion-duration-slow) var(--motion-ease-emphasized)`,
          }}
        >
          {/* 页面标题 */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              功能模块
            </h1>
          </div>

          {/* 模块入口区域 */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
            {modules.map((module, index) => {
              const IconComponent = ICON_MAP.BookOpen || BookOpen;

              return (
                <Link key={module.slug} href={getModuleHref(module.slug)}>
                  <Card
                    className="h-full cursor-pointer transition-all hover:shadow-lg hover:border-primary/50 group"
                    style={{
                      opacity: isPageVisible ? 1 : 0,
                      transform: isPageVisible ? 'translateY(0)' : 'translateY(12px)',
                      transition: `opacity var(--motion-duration-standard) var(--motion-ease-emphasized) ${100 + index * 60}ms,
                                   transform var(--motion-duration-standard) var(--motion-ease-emphasized) ${100 + index * 60}ms,
                                   box-shadow 200ms ease,
                                   border-color 200ms ease`,
                    }}
                  >
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-12 w-12 items-center justify-center rounded-lg"
                          style={{ backgroundColor: appearance.theme.primary }}
                        >
                          <IconComponent className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-xl group-hover:text-primary transition-colors">
                            {module.title}
                          </CardTitle>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-base">
                        {module.description || '点击进入功能模块'}
                      </CardDescription>
                      <div className="mt-4 flex items-center text-sm text-primary">
                        <span>开始使用</span>
                        <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>

          {/* 空状态提示 */}
          {modules.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">暂无可用的功能模块</p>
            </div>
          )}
        </main>
      </AppShell>
      </>
    </NavigationGuardProvider>
  );
}
