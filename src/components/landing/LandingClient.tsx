'use client';

import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowRight, BookOpen, Sparkles } from 'lucide-react';
import BrandBackground from '@/components/ui/brand-background';
import { Card } from '@/components/ui/card';
import AppShell from '@/components/layout/AppShell';
import { NavigationGuardProvider } from '@/providers/NavigationGuardContext';
import { PageSkeleton } from '@/components/ui/page-skeleton';
import { usePageFirstLoad } from '@/hooks/usePageFirstLoad';
import type { PlatformConfig } from '@/types/platform';
import type { PageModulePublicMeta } from '@/types/module';

// 图标映射表
const ICON_MAP: Record<string, ComponentType<{ className?: string }>> = {
  BookOpen,
};

interface LandingClientProps {
  platformConfig: PlatformConfig;
  modules: PageModulePublicMeta[];
}

function getModuleHref(slug: string): string {
  return `/evaluate/${slug}`;
}

export default function LandingClient({ platformConfig, modules }: LandingClientProps) {
  const { appearance } = platformConfig;
  const { brand } = appearance;
  const pathname = usePathname();
  const router = useRouter();
  const prefetchedRef = useRef(false);

  // 检测是否首次加载，只在首次显示骨架屏
  const isFirstLoad = usePageFirstLoad();

  // 页面过渡状态
  const [isPageVisible, setIsPageVisible] = useState(false);

  // 路由变化时触发页面过渡动画
  useEffect(() => {
    // 使用 setTimeout 延迟状态更新
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
  // 主页渲染完成后，在浏览器空闲时预取所有评估模块页面。
  // 这样用户点击进入时页面已缓存，实现秒开体验。
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

  // 首次加载时显示骨架屏
  if (isFirstLoad) {
    return <PageSkeleton type="landing" />;
  }

  return (
    <NavigationGuardProvider>
      <>
        <BrandBackground appearance={appearance} />

        <AppShell
          siteTitle={brand.name}
          primaryColor={appearance.theme.primary}
          modules={modules}
        >
        <main 
          className="mx-auto w-full max-w-4xl px-4 py-16 sm:px-6 lg:px-8"
          style={{
            opacity: isPageVisible ? 1 : 0,
            transform: isPageVisible ? 'translateY(0)' : 'translateY(16px)',
            transition: `opacity var(--motion-duration-slow) var(--motion-ease-emphasized),
                         transform var(--motion-duration-slow) var(--motion-ease-emphasized)`,
          }}
        >
          {/* Hero 区域 */}
          <div className="mb-14 text-center">
            {brand.slogan && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-border bg-primary-soft px-3.5 py-1.5 text-sm font-medium text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                {brand.slogan}
              </span>
            )}
            <h1 className="mt-6 text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
              {brand.name}
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              选择一个诊断模块，开始你的文本评估之旅
            </p>
          </div>

          {/* 模块入口区域 */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
            {modules.map((module, index) => {
              const IconComponent = ICON_MAP.BookOpen || BookOpen;

              return (
                <Link key={module.slug} href={getModuleHref(module.slug)}>
                  <Card
                    className="group h-full cursor-pointer hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-pop"
                    style={{
                      opacity: isPageVisible ? 1 : 0,
                      transform: isPageVisible ? 'translateY(0)' : 'translateY(12px)',
                      transition: `opacity var(--motion-duration-standard) var(--motion-ease-emphasized) ${100 + index * 60}ms,
                                   transform var(--motion-duration-standard) var(--motion-ease-emphasized) ${100 + index * 60}ms,
                                   translate 200ms ease,
                                   box-shadow 200ms ease,
                                   border-color 200ms ease`,
                    }}
                  >
                    <div className="flex flex-col gap-5 px-6">
                      <div className="flex items-start justify-between">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft">
                          <IconComponent className="h-5 w-5 text-primary" />
                        </div>
                        <ArrowRight className="mt-1 h-4 w-4 -translate-x-1 text-primary opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-foreground">
                          {module.title}
                        </h3>
                        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                          {module.description || '点击进入功能模块'}
                        </p>
                      </div>
                    </div>
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

          {/* 底部脚注 */}
          {modules.length > 0 && (
            <p className="mt-16 text-center text-sm text-muted-foreground">
              {brand.name} · 已提供 {modules.length} 个诊断模块
            </p>
          )}
        </main>
      </AppShell>
      </>
    </NavigationGuardProvider>
  );
}
