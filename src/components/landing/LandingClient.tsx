'use client';

import { useEffect, useState, type ComponentType, type CSSProperties } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, BookMarked, BookOpen, Music2, PenLine, Sparkles, Workflow } from 'lucide-react';
import BrandBackground from '@/components/ui/brand-background';
import { Card } from '@/components/ui/card';
import AppShell from '@/components/layout/AppShell';
import { NavigationGuardProvider } from '@/providers/NavigationGuardContext';
import { usePageFirstLoad } from '@/hooks/usePageFirstLoad';
import type { AppearanceConfig } from '@/server/config/types';
import type { ModuleAccentTone, PageModulePublicMeta } from '@/types/module';

// 图标映射表：模块通过 entry.icon 声明（lucide 图标名），未注册的名称回退到默认图标
type IconComponentType = ComponentType<{ className?: string; style?: CSSProperties }>;

const ICON_MAP: Record<string, IconComponentType> = {
  BookOpen,
  BookMarked,
  PenLine,
  Music2,
  Workflow,
};
const DEFAULT_ICON = BookOpen;

/**
 * 卡片主色调样式表
 *
 * 键名对应 ModuleAccentTone（设计令牌），不使用任意色值，
 * 保证各模块卡片色相虽不同，仍收敛在既有视觉体系内。
 */
const ACCENT_STYLES: Record<
  ModuleAccentTone,
  { tileBg: string; tileColor: string; chipBg: string; chipColor: string }
> = {
  primary: {
    tileBg: 'var(--primary-soft)',
    tileColor: 'var(--primary)',
    chipBg: 'var(--primary-soft)',
    chipColor: 'var(--primary)',
  },
  violet: {
    tileBg: 'color-mix(in oklab, var(--brand-violet) 14%, transparent)',
    tileColor: 'var(--brand-violet)',
    chipBg: 'color-mix(in oklab, var(--brand-violet) 10%, transparent)',
    chipColor: 'var(--brand-violet)',
  },
  blue: {
    tileBg: 'var(--report-score-blue-soft)',
    tileColor: 'var(--report-score-blue)',
    chipBg: 'var(--report-score-blue-soft)',
    chipColor: 'var(--report-score-blue)',
  },
  green: {
    tileBg: 'var(--report-score-green-soft)',
    tileColor: 'var(--report-score-green)',
    chipBg: 'var(--report-score-green-soft)',
    chipColor: 'var(--report-score-green)',
  },
  amber: {
    tileBg: 'var(--report-score-gold-soft)',
    tileColor: 'var(--report-score-gold)',
    chipBg: 'var(--report-score-gold-soft)',
    chipColor: 'var(--report-score-gold)',
  },
};

interface LandingClientProps {
  appearance: AppearanceConfig;
  modules: PageModulePublicMeta[];
}

function getModuleHref(slug: string): string {
  return `/evaluate/${slug}`;
}

function resolveModuleIcon(iconName?: string): IconComponentType {
  if (!iconName) {
    return DEFAULT_ICON;
  }
  return ICON_MAP[iconName] ?? DEFAULT_ICON;
}

export default function LandingClient({ appearance, modules }: LandingClientProps) {
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
          className="mx-auto w-full max-w-5xl px-4 pb-24 pt-16 sm:px-6 lg:px-8"
          style={{
            minHeight: 'calc(100vh - 65px)',
            opacity: isPageVisible ? 1 : 0,
            transform: isPageVisible ? 'translateY(0)' : 'translateY(16px)',
            transition: `opacity var(--motion-duration-slow) var(--motion-ease-emphasized),
                         transform var(--motion-duration-slow) var(--motion-ease-emphasized)`,
          }}
        >
          {/* Hero 区域：品牌陈述，视觉重心 */}
          <section className="mb-20 text-center">
            {brand.slogan && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-border bg-primary-soft px-3.5 py-1.5 text-sm font-medium text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                {brand.slogan}
              </span>
            )}
            <h1 className="text-accent-gradient mt-7 text-6xl font-bold tracking-tight sm:text-7xl">
              {brand.name}
            </h1>
            <p className="mx-auto mt-6 max-w-xl font-serif text-lg leading-relaxed text-muted-foreground">
              以文眼识文心——为文字给出严谨、细腻而可信的诊断
            </p>
          </section>

          {/* 模块展示区 */}
          {modules.length > 0 && (
            <section aria-label="诊断模块">
              <div className="mb-6 flex items-baseline gap-3">
                <span className="text-xs font-medium tracking-widest text-muted-foreground">
                  DIAGNOSIS MODULES
                </span>
                <span className="h-px flex-1 bg-border" aria-hidden="true" />
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                {modules.map((module, index) => {
                  const IconComponent = resolveModuleIcon(module.icon);
                  const accent = ACCENT_STYLES[module.landing?.accent ?? 'primary'];

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
                            <div
                              className="flex h-11 w-11 items-center justify-center rounded-xl"
                              style={{ backgroundColor: accent.tileBg }}
                            >
                              <IconComponent className="h-5 w-5" style={{ color: accent.tileColor }} />
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
                          {/* 自描述契约内容：点睛文案与亮点标签，缺省时自然退化为简洁卡片 */}
                          {(module.landing?.tagline || (module.landing?.highlights?.length ?? 0) > 0) && (
                            <div className="border-t border-border/70 pt-4">
                              {module.landing?.tagline && (
                                <p className="text-[13px] leading-relaxed text-foreground/75">
                                  {module.landing.tagline}
                                </p>
                              )}
                              {module.landing?.highlights && module.landing.highlights.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-1.5">
                                  {module.landing.highlights.map((highlight) => (
                                    <span
                                      key={highlight}
                                      className="rounded-full px-2.5 py-1 text-xs font-medium"
                                      style={{
                                        backgroundColor: accent.chipBg,
                                        color: accent.chipColor,
                                      }}
                                    >
                                      {highlight}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* 空状态提示 */}
          {modules.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">暂无可用的功能模块</p>
            </div>
          )}

          {/* 底部脚注 */}
          {modules.length > 0 && (
            <p className="mt-20 text-center text-sm text-muted-foreground">
              {brand.name} · 已提供 {modules.length} 个诊断模块
            </p>
          )}
        </main>
      </AppShell>
      </>
    </NavigationGuardProvider>
  );
}
