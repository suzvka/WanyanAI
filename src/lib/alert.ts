import { toast } from 'sonner';

/**
 * 统一错误展示工具
 * 
 * 使用 Sonner toast 展示错误消息
 * - 背景跟随主题色
 * - 红色仅用于图标
 * - 样式与项目设计系统一致
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
 * 展示错误提示
 */
export function showAlert(message: string, options?: AlertOptions): void {
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
