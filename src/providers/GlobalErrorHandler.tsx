'use client';

import { useEffect, useCallback } from 'react';
import { showError } from '@/lib/alert';
import { toAppErrorPayload } from '@/types/errors';

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
    // 阻止默认行为（控制台输出）
    event.preventDefault();

    const payload = toAppErrorPayload(event.reason, {
      code: 'unknown_error',
      message: '发生未知错误，请刷新页面重试。',
    });

    // 显示错误通知
    showError(payload.message, 6000);

    // 开发环境输出详细信息
    if (process.env.NODE_ENV === 'development') {
      console.error('[GlobalErrorHandler] Unhandled rejection:', event.reason);
    }
  }, []);

  const handleError = useCallback((event: ErrorEvent) => {
    // 只处理非 React 错误（React 错误由 Error Boundary 处理）
    // 这里主要捕获脚本加载错误等
    if (event.target && 'tagName' in event.target) {
      // 资源加载错误（图片、脚本等）
      const target = event.target as HTMLElement;
      if (target.tagName === 'IMG' || target.tagName === 'SCRIPT' || target.tagName === 'LINK') {
        console.warn('[GlobalErrorHandler] Resource load error:', target);
        return;
      }
    }

    // 其他错误显示通知
    const payload = toAppErrorPayload(event.error, {
      code: 'unknown_error',
      message: '发生错误，请刷新页面重试。',
    });

    showError(payload.message, 6000);

    if (process.env.NODE_ENV === 'development') {
      console.error('[GlobalErrorHandler] Uncaught error:', event.error);
    }
  }, []);

  useEffect(() => {
    // 监听未处理的 Promise rejection
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    // 监听全局错误
    window.addEventListener('error', handleError, true);

    return () => {
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
  children: React.ReactNode;
}) {
  useGlobalErrorHandler();
  return <>{children}</>;
}
