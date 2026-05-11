'use client';

import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';
import { cn } from '@/lib/utils';

/**
 * 可折叠组件
 * - 支持平滑的高度过渡动画
 * - 使用 CSS Grid 实现动画效果
 * - 使用 forceMount 确保动画可以正常执行
 */

function Collapsible({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Root>) {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />;
}

function CollapsibleTrigger({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleTrigger>) {
  return (
    <CollapsiblePrimitive.CollapsibleTrigger
      data-slot="collapsible-trigger"
      {...props}
    />
  );
}

function CollapsibleContent({
  children,
  className,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.CollapsibleContent>) {
  return (
    <CollapsiblePrimitive.CollapsibleContent
      data-slot="collapsible-content"
      // forceMount 确保内容始终渲染，让 CSS 动画可以正常执行
      forceMount
      className={className}
      {...props}
    >
      {/* 包装层：用于 overflow hidden */}
      <div className="collapsible-wrapper">
        {/* 内部内容层：用于淡入淡出动画 */}
        <div className="collapsible-inner">{children}</div>
      </div>
    </CollapsiblePrimitive.CollapsibleContent>
  );
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
