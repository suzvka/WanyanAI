'use client';

import { useEffect, useCallback, type ReactNode } from 'react';
import {
  reportClientError,
  reportConsoleMessage,
  reportUnhandledRejection,
  reportWindowError,
} from '@/lib/client-errors/report';

/**
 * 全局错误处理 Hook
 * 
 * 捕获未处理的 Promise rejection 和全局错误
 * 
 * @example
 * ```tsx
 * function App() {
 *   useGlobalErrorHandler();
 *   return <>{children}</>;
 * }
 * ```
 */
export function useGlobalErrorHandler() {
  const handleUnhandledRejection = useCallback((event: PromiseRejectionEvent) => {
    event.preventDefault();

    reportUnhandledRejection(event.reason);
  }, []);

  const handleError = useCallback((event: ErrorEvent) => {
    // 只处理非 React 错误（React 错误由 Error Boundary 处理）
    // 这里主要捕获脚本加载错误等
    if (event.target && 'tagName' in event.target) {
      // 资源加载错误（图片、脚本等）
      const target = event.target as HTMLElement;
      if (target.tagName === 'IMG' || target.tagName === 'SCRIPT' || target.tagName === 'LINK') {
        reportClientError({
          source: 'runtime',
          level: 'warning',
          message: `资源加载失败：${target.tagName.toLowerCase()}`,
          notify: false,
        });
        return;
      }
    }

    reportWindowError(event.error, event.message || '发生错误，请刷新页面重试。');
  }, []);

  useEffect(() => {
    const originalConsoleError = console.error;

    console.error = (...args: unknown[]) => {
      reportConsoleMessage('error', args);
      originalConsoleError.apply(console, args);
    };

    // 监听未处理的 Promise rejection
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    // 监听全局错误
    window.addEventListener('error', handleError, true);

    return () => {
      console.error = originalConsoleError;
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError, true);
    };
  }, [handleUnhandledRejection, handleError]);
}

/**
 * 全局错误处理 Provider
 * 
 * 放置在应用根部，捕获所有未处理的错误
 */
export function GlobalErrorHandler({
  children,
}: {
  children: ReactNode;
}) {
  useGlobalErrorHandler();
  return <>{children}</>;
}
