'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

/**
 * 页面过渡动画组件
 * 
 * 特性：
 * - 页面进入时使用淡入 + 上滑动画
 * - 子元素支持交错动画（staggered reveals）
 * - 路由变化时自动触发过渡效果
 * - 使用 CSS 变量控制动画时长，与项目主题一致
 */
export function PageTransition({ children, className = '' }: PageTransitionProps) {
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);
  const prevPathnameRef = useRef(pathname);

  // 路由变化时触发过渡动画
  useEffect(() => {
    // 首次加载或路由变化
    if (prevPathnameRef.current !== pathname) {
      // 路由变化：先淡出再淡入
      const hideTimer = setTimeout(() => setIsVisible(false), 0);
      const showTimer = setTimeout(() => {
        setAnimationKey((k) => k + 1);
        setIsVisible(true);
      }, 100);
      prevPathnameRef.current = pathname;
      return () => {
        clearTimeout(hideTimer);
        clearTimeout(showTimer);
      };
    } else {
      // 首次加载：直接淡入
      const timer = setTimeout(() => setIsVisible(true), 50);
      return () => clearTimeout(timer);
    }
  }, [pathname]);

  return (
    <div
      key={animationKey}
      className={`page-transition-wrapper ${className}`}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(8px)',
        transition: `opacity var(--motion-duration-standard) var(--motion-ease-emphasized),
                     transform var(--motion-duration-standard) var(--motion-ease-emphasized)`,
      }}
    >
      {children}
    </div>
  );
}

/**
 * 页面内容交错动画容器
 * 
 * 子元素会依次延迟出现，创造视觉节奏感
 */
export function StaggeredContent({ 
  children, 
  className = '',
  staggerDelay = 50,
}: { 
  children: ReactNode; 
  className?: string;
  staggerDelay?: number; // ms
}) {
  return (
    <div className={`staggered-content ${className}`}>
      {Array.isArray(children) 
        ? children.map((child, index) => (
            <div
              key={index}
              className="staggered-item"
              style={{
                animationDelay: `${index * staggerDelay}ms`,
              }}
            >
              {child}
            </div>
          ))
        : children
      }
    </div>
  );
}

/**
 * 链接点击过渡处理 Hook
 * 
 * 使用 View Transitions API 实现原生页面过渡
 */
export function useViewTransition() {
  const [isTransitioning, setIsTransitioning] = useState(false);

  const startTransition = (callback: () => void) => {
    // 检查浏览器是否支持 View Transitions API
    if (typeof document !== 'undefined' && 'startViewTransition' in document) {
      setIsTransitioning(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (document as any).startViewTransition(() => {
        callback();
        setIsTransitioning(false);
      });
    } else {
      // 降级方案：直接执行回调
      callback();
    }
  };

  return { isTransitioning, startTransition };
}
