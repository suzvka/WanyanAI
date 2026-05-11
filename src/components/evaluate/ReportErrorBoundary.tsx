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
import { AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react';
import { reportReactError } from '@/lib/client-errors/report';

/**
 * 报告渲染错误信息
 */
export type ReportErrorInfo = {
  message: string;
  retryable: boolean;
  code?: string;
};

/**
 * 报告错误边界 Props
 */
export type ReportErrorBoundaryProps = {
  children: ReactNode;
  /** 发生错误时的回调 */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** 返回编辑页面的回调 */
  onBackToEdit: () => void;
  /** 重试生成报告的回调 */
  onRetry?: () => void;
};

/**
 * 报告错误边界 State
 */
type ReportErrorBoundaryState = {
  hasError: boolean;
  error: ReportErrorInfo | null;
};

/**
 * 从错误对象中提取错误信息
 */
function extractErrorInfo(error: unknown): ReportErrorInfo {
  // 检查是否是我们自定义的 AppError
  if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
    const appError = error as { code?: string; message: string; retryable?: boolean };
    return {
      message: appError.message || '报告生成过程中发生错误',
      retryable: appError.retryable ?? true,
      code: appError.code,
    };
  }

  // 标准 Error 对象
  if (error instanceof Error) {
    return {
      message: error.message || '报告生成过程中发生未知错误',
      retryable: true,
    };
  }

  // 其他情况
  return {
    message: '报告生成过程中发生未知错误',
    retryable: true,
  };
}

/**
 * 报告渲染错误边界
 * 
 * 捕获报告渲染过程中的所有异常，显示友好的错误弹窗而非页面崩溃。
 * 
 * 使用示例：
 * ```tsx
 * <ReportErrorBoundary
 *   onBackToEdit={handleBackToEdit}
 *   onRetry={handleRetry}
 * >
 *   <OutputRenderer data={report} />
 * </ReportErrorBoundary>
 * ```
 */
export class ReportErrorBoundary extends Component<
  ReportErrorBoundaryProps,
  ReportErrorBoundaryState
> {
  constructor(props: ReportErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ReportErrorBoundaryState {
    return {
      hasError: true,
      error: extractErrorInfo(error),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    reportReactError(error, {
      source: 'react-report',
      detail: errorInfo.componentStack || undefined,
    });

    // 调用外部错误处理回调（可用于日志记录）
    this.props.onError?.(error, errorInfo);
  }

  handleBackToEdit = () => {
    // 重置错误状态并返回编辑
    this.setState({ hasError: false, error: null });
    this.props.onBackToEdit();
  };

  handleRetry = () => {
    // 重置错误状态
    this.setState({ hasError: false, error: null });
    // 调用重试回调
    this.props.onRetry?.();
  };

  render() {
    const { hasError, error } = this.state;
    const { children } = this.props;

    if (hasError && error) {
      return (
        <AlertDialog open={true} onOpenChange={() => {}}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                </div>
                <AlertDialogTitle>报告生成失败</AlertDialogTitle>
              </div>
              <AlertDialogDescription className="pt-4">
                {error.message}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
              {error.retryable && this.props.onRetry && (
                <Button onClick={this.handleRetry} className="w-full sm:w-auto">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  重新生成
                </Button>
              )}
              <Button
                variant="outline"
                onClick={this.handleBackToEdit}
                className="w-full sm:w-auto"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回修改输入
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      );
    }

    return children;
  }
}

/**
 * 函数式包装组件（便于使用 hooks）
 */
export function ReportErrorBoundaryWrapper({
  children,
  onBackToEdit,
  onRetry,
  onError,
}: {
  children: ReactNode;
  onBackToEdit: () => void;
  onRetry?: () => void;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}) {
  return (
    <ReportErrorBoundary
      onBackToEdit={onBackToEdit}
      onRetry={onRetry}
      onError={onError}
    >
      {children}
    </ReportErrorBoundary>
  );
}
