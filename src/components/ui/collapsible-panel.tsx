'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface CollapsiblePanelProps {
  /** 主标题，为空时不显示 */
  title?: string;
  /** 副标题，为空时不显示 */
  subtitle?: string;
  /** 标题栏右侧的操作区域 */
  headerAction?: React.ReactNode;
  /** 面板内容 */
  children: React.ReactNode;
  /** 默认是否展开 */
  defaultExpanded?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 标题栏自定义类名 */
  headerClassName?: string;
  /** 内容区自定义类名 */
  contentClassName?: string;
  /** 是否禁用折叠功能 */
  disabled?: boolean;
}

/**
 * 可折叠面板组件
 * - 标题栏：系统主题底色，不透明，保持清晰可读
 * - 内容区：应用主题色派生的柔和底色，高透明 + 高斯模糊
 * - 标题栏高度与"开始分析"按钮一致 (h-14)
 * - 支持平滑的折叠/展开动画 (通过 CSS Grid 实现)
 * - 边框跟随内容同步过渡
 */
export default function CollapsiblePanel({
  title,
  subtitle,
  headerAction,
  children,
  defaultExpanded = true,
  className,
  headerClassName,
  contentClassName,
  disabled = false,
}: CollapsiblePanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const hasTitle = title && title.trim().length > 0;
  const hasSubtitle = subtitle && subtitle.trim().length > 0;

  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={disabled ? undefined : setIsExpanded}
      className={cn(
        'rounded-xl overflow-hidden',
        // 边框和阴影
        'border border-border shadow-sm',
        // 边框过渡动画
        'transition-all duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
        className,
      )}
    >
      {/* 标题栏 - 系统主题色，不透明 */}
      <CollapsibleTrigger
        asChild
        disabled={disabled}
      >
        <div
          className={cn(
            'flex h-14 items-center justify-between px-4',
            'bg-background',
            // 边框过渡：折叠时透明度渐变
            'border-b border-border transition-all duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
            // 展开时显示下边框，折叠时隐藏
            isExpanded ? 'border-b-border' : 'border-b-transparent',
            !disabled && 'cursor-pointer hover:bg-[color:var(--report-surface-strong)] select-none',
            disabled && 'cursor-default select-none',
            headerClassName,
          )}
        >
          {/* 左侧标题区 */}
          <div className="flex items-center gap-2 min-w-0 select-none">
            {hasTitle && (
              <span className="text-lg font-semibold leading-tight truncate text-foreground">
                {title}
              </span>
            )}
            {hasTitle && hasSubtitle && (
              <span className="text-muted-foreground select-none">·</span>
            )}
            {hasSubtitle && (
              <span className="text-sm text-muted-foreground leading-tight truncate">
                {subtitle}
              </span>
            )}
          </div>

          {/* 右侧操作区 */}
          <div className="flex items-center gap-2 flex-shrink-0 select-none">
            {headerAction}
            {!disabled && (
              <ChevronDown
                className={cn(
                  'h-4 w-4 text-muted-foreground transition-transform duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
                  isExpanded && 'rotate-180',
                )}
              />
            )}
          </div>
        </div>
      </CollapsibleTrigger>

      {/* 内容区 - 动画由 globals.css 控制 */}
      <CollapsibleContent>
        <div
          className={cn(
            'p-4 bg-transparent backdrop-blur-[2px]',
            contentClassName,
          )}
        >
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
