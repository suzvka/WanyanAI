'use client';

import { useCallback, useRef } from 'react';
import { showError } from '@/lib/alert';
import { toAppErrorPayload } from '@/types/errors';

/**
 * 异步操作选项
 */
type AsyncActionOptions = {
  /** 是否显示错误通知，默认 true */
  showErrorToast?: boolean;
  /** 自定义错误消息 */
  errorMessage?: string;
  /** 错误回调 */
  onError?: (error: Error) => void;
  /** 成功回调 */
  onSuccess?: () => void;
  /** 完成回调（无论成功失败都会调用） */
  onFinally?: () => void;
};

/**
 * 异步操作结果
 */
type AsyncActionResult<T> = {
  /** 是否成功 */
  success: boolean;
  /** 返回数据（成功时） */
  data?: T;
  /** 错误信息（失败时） */
  error?: string;
};

/**
 * useAsyncAction - 统一异步操作 Hook
 * 
 * 自动处理异步操作的错误，确保用户收到通知。
 * 
 * @example
 * ```tsx
 * const { execute, isLoading } = useAsyncAction(async (data) => {
 *   const result = await api.submit(data);
 *   return result;
 * }, {
 *   errorMessage: '提交失败',
 *   onSuccess: () => router.push('/success'),
 * });
 * 
 * // 调用
 * await execute(formData);
 * ```
 */
export function useAsyncAction<T, Args extends unknown[]>(
  action: (...args: Args) => Promise<T>,
  options: AsyncActionOptions = {}
) {
  const {
    showErrorToast = true,
    errorMessage,
    onError,
    onSuccess,
    onFinally,
  } = options;

  const loadingRef = useRef(false);

  const execute = useCallback(
    async (...args: Args): Promise<AsyncActionResult<T>> => {
      loadingRef.current = true;

      try {
        const result = await action(...args);
        onSuccess?.();
        return { success: true, data: result };
      } catch (error) {
        const payload = toAppErrorPayload(error, {
          code: 'unknown_error',
          message: errorMessage || '操作失败，请重试。',
        });

        if (showErrorToast) {
          showError(payload.message);
        }

        onError?.(error instanceof Error ? error : new Error(payload.message));

        return { success: false, error: payload.message };
      } finally {
        loadingRef.current = false;
        onFinally?.();
      }
    },
    [action, showErrorToast, errorMessage, onError, onSuccess, onFinally]
  );

  return {
    execute,
    get isLoading() {
      return loadingRef.current;
    },
  };
}

/**
 * useAsyncCallback - 简化版，用于事件处理
 * 
 * @example
 * ```tsx
 * const handleSubmit = useAsyncCallback(async (e: React.FormEvent) => {
 *   e.preventDefault();
 *   await submitForm(formData);
 * }, {
 *   errorMessage: '表单提交失败',
 * });
 * ```
 */
export function useAsyncCallback<Args extends unknown[]>(
  callback: (...args: Args) => Promise<void>,
  options: AsyncActionOptions = {}
) {
  const { execute } = useAsyncAction(
    async (...args: Args) => {
      await callback(...args);
    },
    options
  );

  return execute;
}
