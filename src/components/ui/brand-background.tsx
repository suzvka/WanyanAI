'use client';

import type { CSSProperties } from 'react';
import { useTheme } from 'next-themes';
import type { AppearanceConfig } from '@/server/config/types';

interface BrandBackgroundProps {
  appearance: AppearanceConfig;
}

/**
 * 品牌背景组件
 * 
 * 在页面黄金分割位置（从底部算起 61.8%）显示品牌名称
 * 作为背景层，可被其他控件覆盖
 * 
 * 品牌名透明度与背景透明度联动，实现低遮挡效果
 */
export default function BrandBackground({ appearance }: BrandBackgroundProps) {
  const { brand, theme } = appearance;
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const bgOpacity = isDark ? theme.backgroundOpacity.dark : theme.backgroundOpacity.light;
  const colorOffset = isDark ? theme.brandColorOffset.dark : theme.brandColorOffset.light;
  const mixTarget = colorOffset >= 0 ? 'white' : 'black';
  const mixStrength = Math.max(0, Math.min(100, 100 - Math.abs(colorOffset) * 100));
  const textColor = `color-mix(in oklab, var(--brand-primary) ${mixStrength}%, ${mixTarget})`;
  const overlayColor = `color-mix(in oklab, var(--brand-primary) ${bgOpacity * 100}%, transparent)`;
  const brandOpacity = bgOpacity;
  
  return (
    <div
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
      aria-hidden="true"
      style={{
        '--brand-primary': theme.primary,
        '--brand-overlay-color': overlayColor,
        '--brand-text-color': textColor,
      } as CSSProperties}
    >
      <div
        className="bg-brand-overlay absolute inset-0 transition-opacity duration-500"
      />
      <div
        className="absolute left-1/2 bottom-[61.8%] -translate-x-1/2 translate-y-1/2 flex flex-col items-center gap-2 select-none transition-opacity duration-500"
        style={{
          fontFamily: brand.fontFamily || 'var(--font-serif)',
          opacity: brandOpacity,
        }}
      >
        <span
          className="text-brand text-[clamp(3rem,10vw,8rem)] font-bold tracking-tight leading-none"
        >
          {brand.name}
        </span>
        {brand.slogan && (
          <span
            className="text-brand text-[clamp(0.875rem,2vw,1.25rem)] tracking-wide opacity-70"
          >
            {brand.slogan}
          </span>
        )}
      </div>
    </div>
  );
}
