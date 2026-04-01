'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * 导航守卫上下文值
 */
type NavigationGuardContextValue = {
  /** 请求导航，返回 true 表示可以继续，false 表示需要确认 */
  requestNavigate: (target: string) => boolean;
  /** 确认导航（用户点击确认后执行） */
  confirmNavigation: () => void;
  /** 取消导航 */
  cancelNavigation: () => void;
  /** 设置是否有未保存内容 */
  setHasUnsavedContent: (value: boolean) => void;
};

const NavigationGuardContext = createContext<NavigationGuardContextValue | null>(null);

export function useNavigationGuard(): NavigationGuardContextValue {
  const context = useContext(NavigationGuardContext);
  if (!context) {
    throw new Error('useNavigationGuard must be used within NavigationGuardProvider');
  }
  return context;
}

interface NavigationGuardProviderProps {
  children: ReactNode;
}

/**
 * 导航守卫 Provider
 *
 * 提供全局的导航拦截功能，当有未保存内容时弹出确认对话框。
 */
export function NavigationGuardProvider({ children }: NavigationGuardProviderProps) {
  const [hasUnsavedContent, setHasUnsavedContent] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // 请求导航
  const requestNavigate = useCallback((target: string): boolean => {
    if (hasUnsavedContent) {
      setPendingNavigation(target);
      setIsDialogOpen(true);
      return false;
    }
    return true;
  }, [hasUnsavedContent]);

  // 确认导航
  const confirmNavigation = useCallback(() => {
    const target = pendingNavigation;
    setIsDialogOpen(false);
    setPendingNavigation(null);
    setHasUnsavedContent(false); // 清除未保存状态

    if (target) {
      // 使用 window.location 进行导航（因为这是离开当前页面的操作）
      window.location.href = target;
    }
  }, [pendingNavigation]);

  // 取消导航
  const cancelNavigation = useCallback(() => {
    setIsDialogOpen(false);
    setPendingNavigation(null);
  }, []);

  const value: NavigationGuardContextValue = {
    requestNavigate,
    confirmNavigation,
    cancelNavigation,
    setHasUnsavedContent,
  };

  return (
    <NavigationGuardContext.Provider value={value}>
      {children}
      <NavigationGuardDialog
        isOpen={isDialogOpen}
        onConfirm={confirmNavigation}
        onCancel={cancelNavigation}
      />
    </NavigationGuardContext.Provider>
  );
}

interface NavigationGuardDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * 导航确认对话框
 */
function NavigationGuardDialog({ isOpen, onConfirm, onCancel }: NavigationGuardDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent className="border-2 border-[color:var(--destructive)]">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--destructive)]/10">
              <AlertTriangle className="h-5 w-5 text-[color:var(--destructive)]" />
            </div>
            <AlertDialogTitle>离开当前页面？</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="pt-2">
            当前编辑区有未保存的内容，离开后这些内容将会丢失。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>继续编辑</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-[color:var(--destructive)] text-white hover:bg-[color:var(--destructive)]/90"
          >
            确认离开
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
