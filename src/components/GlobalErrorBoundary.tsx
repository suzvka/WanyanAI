'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { reportReactError } from '@/lib/client-errors/report';
import { toAppErrorPayload } from '@/types/errors';

/**
 * 全局错误边界 Props
 */
type GlobalErrorBoundaryProps = {
  children: ReactNode;
  /** 自定义错误回调 */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** 自定义降级 UI */
  fallback?: ReactNode;
};

/**
 * 全局错误边界 State
 */
type GlobalErrorBoundaryState = {
  hasError: boolean;
  error: { message: string; retryable: boolean } | null;
};

function shouldLogDebugError(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

/**
 * 全局错误边界
 * 
 * 捕获 React 组件渲染过程中的所有未处理错误。
 * 应该放置在应用最外层。
 * 
 * @example
 * ```tsx
 * <GlobalErrorBoundary>
 *   <App />
 * </GlobalErrorBoundary>
 * ```
 */
export class GlobalErrorBoundary extends Component<
  GlobalErrorBoundaryProps,
  GlobalErrorBoundaryState
> {
  constructor(props: GlobalErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: unknown): GlobalErrorBoundaryState {
    const payload = toAppErrorPayload(error, {
      code: 'unknown_error',
      message: '页面发生错误，请刷新重试。',
    });

    return {
      hasError: true,
      error: {
        message: payload.message,
        retryable: payload.retryable ?? true,
      },
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    reportReactError(error, {
      source: 'react',
      detail: errorInfo.componentStack,
    });

    // 调用自定义错误回调
    this.props.onError?.(error, errorInfo);

    // 开发环境输出详细信息
    if (shouldLogDebugError()) {
      console.error('[GlobalErrorBoundary] Caught error:', error);
      console.error('[GlobalErrorBoundary] Component stack:', errorInfo.componentStack);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleRefresh = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // 如果提供了自定义 fallback，使用它
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 默认错误 UI
      return (
        <AlertDialog open={true}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
              <AlertDialogTitle className="text-center">
                页面出错了
              </AlertDialogTitle>
              <AlertDialogDescription className="text-center">
                {this.state.error?.message || '发生未知错误'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
              {this.state.error?.retryable && (
                <Button onClick={this.handleRetry} className="w-full sm:w-auto">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  重试
                </Button>
              )}
              <Button
                variant="outline"
                onClick={this.handleRefresh}
                className="w-full sm:w-auto"
              >
                刷新页面
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      );
    }

    return this.props.children;
  }
}
