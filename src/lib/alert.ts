import { toast } from 'sonner';

/**
 * 统一错误展示工具
 * 
 * 使用 Sonner toast 展示错误消息
 * - 背景跟随主题色
 * - 红色仅用于图标
 * - 样式与项目设计系统一致
 * 
 * 注意：此模块只能在客户端使用，服务端调用会被静默忽略
 */

export type AlertType = 'error' | 'warning' | 'info' | 'success';

interface AlertOptions {
  /** 错误类型，默认 'error' */
  type?: AlertType;
  /** 持续时间（毫秒），默认 4000 */
  duration?: number;
  /** 通知唯一标识，用于去重 */
  id?: string | number;
  /** 辅助说明 */
  description?: string;
}

/**
 * 检查是否在客户端环境
 */
function isClientEnvironment(): boolean {
  return typeof window !== 'undefined';
}

/**
 * 展示错误提示
 * 
 * 注意：在服务端调用会被静默忽略
 */
export function showAlert(message: string, options?: AlertOptions): void {
  // 服务端不展示 toast
  if (!isClientEnvironment()) {
    // 可选：在开发环境下记录日志
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Alert] ${options?.type || 'error'}: ${message}`);
    }
    return;
  }

  const { type = 'error', duration = 4000, id, description } = options || {};
  const toastOptions = { duration, id, description };

  switch (type) {
    case 'error':
      toast.error(message, toastOptions);
      break;
    case 'warning':
      toast.warning(message, toastOptions);
      break;
    case 'info':
      toast.info(message, toastOptions);
      break;
    case 'success':
      toast.success(message, toastOptions);
      break;
    default:
      toast.error(message, toastOptions);
  }
}

/**
 * 展示错误提示（便捷方法）
 */
export function showError(message: string, duration?: number): void {
  showAlert(message, { type: 'error', duration });
}

/**
 * 展示警告提示（便捷方法）
 */
export function showWarning(message: string, duration?: number): void {
  showAlert(message, { type: 'warning', duration });
}

/**
 * 展示信息提示（便捷方法）
 */
export function showInfo(message: string, duration?: number): void {
  showAlert(message, { type: 'info', duration });
}

/**
 * 展示成功提示（便捷方法）
 */
export function showSuccess(message: string, duration?: number): void {
  showAlert(message, { type: 'success', duration });
}

/**
 * 展示带操作的成功提示
 */
export function showSuccessWithAction(
  message: string,
  options?: {
    duration?: number;
  }
): void {
  showAlert(message, { 
    type: 'success', 
    duration: options?.duration,
  });
}
