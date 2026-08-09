'use client';

import { useSyncExternalStore, type CSSProperties } from 'react';
import { useTheme } from 'next-themes';
import type { AppearanceConfig } from '@/server/config/types';

interface BrandBackgroundProps {
  appearance: AppearanceConfig;
}

/**
 * 品牌背景组件
 *
 * 低透明度径向光晕（靛蓝偏左上、紫罗兰偏右下）+ 顶部渐变高光线，
 * 为页面营造安静的空间层次，不抢占内容焦点。
 *
 * 光晕不透明度与 appearance.json 的 backgroundOpacity 联动。
 */
export default function BrandBackground({ appearance }: BrandBackgroundProps) {
  const { theme } = appearance;
  const { resolvedTheme } = useTheme();
  // Hydration 安全：SSR 视为未挂载，客户端挂载后立即为 true，再过渡到实际主题
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const isDark = mounted && resolvedTheme === 'dark';
  const glowOpacity = isDark
    ? theme.backgroundOpacity.dark
    : theme.backgroundOpacity.light;

  return (
    <div
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
      aria-hidden="true"
      style={{ '--brand-primary': theme.primary } as CSSProperties}
    >
      {/* 左上：主色径向光晕 */}
      <div
        className="absolute -top-48 -left-48 h-[40rem] w-[40rem] rounded-full transition-opacity duration-500"
        style={{
          background:
            'radial-gradient(closest-side, var(--brand-primary), transparent)',
          opacity: glowOpacity,
        }}
      />
      {/* 右下：紫罗兰径向光晕 */}
      <div
        className="absolute -bottom-56 -right-56 h-[42rem] w-[42rem] rounded-full transition-opacity duration-500"
        style={{
          background:
            'radial-gradient(closest-side, var(--brand-violet), transparent)',
          opacity: glowOpacity * 0.8,
        }}
      />
      {/* 顶部渐变高光线 */}
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent, color-mix(in oklab, var(--brand-primary) 40%, transparent), transparent)',
        }}
      />
    </div>
  );
}
