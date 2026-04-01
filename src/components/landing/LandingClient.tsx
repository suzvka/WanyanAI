'use client';

import Link from 'next/link';
import { ArrowRight, BookOpen } from 'lucide-react';
import BrandBackground from '@/components/ui/brand-background';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AppShell from '@/components/layout/AppShell';
import { NavigationGuardProvider } from '@/providers/NavigationGuardContext';
import { PageSkeleton } from '@/components/ui/page-skeleton';
import { usePageFirstLoad } from '@/hooks/usePageFirstLoad';
import type { PlatformConfig } from '@/types/platform';
import type { ModuleConfig } from '@/types/module';

// 图标映射表
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  BookOpen,
};

interface LandingClientProps {
  platformConfig: PlatformConfig;
  modules: ModuleConfig[];
}

export default function LandingClient({ platformConfig, modules }: LandingClientProps) {
  const { appearance } = platformConfig;
  const { brand } = appearance;

  // 检测是否首次加载，只在首次显示骨架屏
  const isFirstLoad = usePageFirstLoad();

  // 过滤并排序侧栏启用的模块
  const sidebarModules = modules
    .filter((m) => m.manifest.sidebar.enabled)
    .sort((a, b) => a.manifest.sidebar.order - b.manifest.sidebar.order);

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
        <main className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
          {/* 品牌区域 */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold tracking-tight text-foreground mb-4">
              {brand.name}
            </h1>
            {brand.slogan && (
              <p className="text-xl text-muted-foreground">
                {brand.slogan}
              </p>
            )}
          </div>

          {/* 模块入口区域 */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
            {sidebarModules.map((module) => {
              const IconComponent = ICON_MAP[module.manifest.sidebar.icon] || BookOpen;

              return (
                <Link key={module.manifest.id} href={module.manifest.route}>
                  <Card className="h-full cursor-pointer transition-all hover:shadow-lg hover:border-primary/50 group">
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
                            {module.manifest.name}
                          </CardTitle>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-base">
                        {module.manifest.description || '点击进入功能模块'}
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
          {sidebarModules.length === 0 && (
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
