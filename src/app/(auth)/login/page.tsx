'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Loader2, LogIn } from 'lucide-react';

// ============ 类型 ============

interface UserInfo {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface PostMessageEvent {
  type: string;
  payload?: {
    token?: string;
    user?: UserInfo;
    message?: string;
  };
}

type LoginStatus = 'idle' | 'loading' | 'issuing' | 'success' | 'error';

// ============ 常量 ============

const POPUP_WIDTH = 480;
const POPUP_HEIGHT = 600;

// ============ 组件 ============

export default function LoginPage() {
  const router = useRouter();
  const popupRef = useRef<Window | null>(null);
  const [status, setStatus] = useState<LoginStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [userCenterUrl, setUserCenterUrl] = useState('');
  const [allowedOrigins, setAllowedOrigins] = useState<string[]>([]);
  const [configLoaded, setConfigLoaded] = useState(false);

  // 加载运行时配置（避免 NEXT_PUBLIC_* 构建时内联问题）
  useEffect(() => {
    fetch('/api/v1/config')
      .then((r) => r.json())
      .then((cfg) => {
        setUserCenterUrl(cfg.userCenterUrl || '');
        // allowedOrigins 包含 userCenterUrl 自身 + 用户配置的额外可信来源
        // 用于处理用户中心域名重定向到后台域名后 postMessage origin 变更的场景
        setAllowedOrigins(Array.isArray(cfg.allowedOrigins) ? cfg.allowedOrigins : []);
        setConfigLoaded(true);
      })
      .catch(() => {
        setConfigLoaded(true);
      });
  }, []);

  // 签发 station token
  const issueToken = useCallback(async (accountToken: string, user: UserInfo) => {
    setStatus('issuing');
    setStatusMessage('正在签发访问凭证...');

    const res = await fetch('/api/v1/auth/issue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountToken, user }),
    });

    const data = await res.json();

    if (!res.ok) {
      setStatus('error');
      setStatusMessage(data.error || '签发凭证失败');
      return;
    }

    sessionStorage.setItem('station_token', data.token);
    sessionStorage.setItem('station_user', JSON.stringify(user));
    if (data.membership) {
      sessionStorage.setItem('station_membership', JSON.stringify({
        level: data.membershipLevel,
        permissionLevel: data.permissionLevel,
        expiresAt: data.expiresAt,
      }));
    }

    setStatus('success');
    setStatusMessage(`登录成功！欢迎回来，${user.name}`);

    setTimeout(() => router.push('/'), 800);
  }, [router]);

  // 监听 postMessage（来自弹窗）
  const handleMessage = useCallback(
    (e: MessageEvent<PostMessageEvent>) => {
      // 校验消息来源：优先使用 allowedOrigins 列表，兼容重定向场景
      const isOriginAllowed =
        allowedOrigins.length > 0
          ? allowedOrigins.includes(e.origin)
          : userCenterUrl !== '' && e.origin === userCenterUrl;

      if (!isOriginAllowed) return;

      const { type, payload } = e.data;
      if (!type) return;

      switch (type) {
        case 'auth:sign-in:success': {
          if (!payload?.token || !payload?.user) return;

          // 关闭弹窗
          popupRef.current?.close();
          popupRef.current = null;

          issueToken(payload.token, payload.user);
          break;
        }

        case 'auth:sign-in:error':
          setStatus('error');
          setStatusMessage(payload?.message || '登录失败');
          popupRef.current?.close();
          popupRef.current = null;
          break;
      }
    },
    [issueToken, allowedOrigins, userCenterUrl],
  );

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  // 监听弹窗被关闭（用户手动关闭）
  useEffect(() => {
    const timer = setInterval(() => {
      if (popupRef.current?.closed) {
        popupRef.current = null;
        if (status === 'loading') {
          setStatus('idle');
          setStatusMessage('');
        }
      }
    }, 500);
    return () => clearInterval(timer);
  }, [status]);

  // 打开登录弹窗
  const openLoginPopup = useCallback(() => {
    if (!userCenterUrl) {
      setStatus('error');
      setStatusMessage('未配置用户中心地址，请联系管理员');
      return;
    }

    setStatus('loading');
    setStatusMessage('请在新窗口中完成登录...');

    const left = window.screenX + (window.outerWidth - POPUP_WIDTH) / 2;
    const top = window.screenY + (window.outerHeight - POPUP_HEIGHT) / 2;

    popupRef.current = window.open(
      `${userCenterUrl}/embed/sign-in`,
      'login-popup',
      `width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top}`,
    );

    if (!popupRef.current) {
      setStatus('error');
      setStatusMessage('弹窗被浏览器拦截，请允许弹窗后重试');
    }
  }, [userCenterUrl]);

  const isBusy = status === 'loading' || status === 'issuing';

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">登录</CardTitle>
          <CardDescription>使用您的账户登录以继续</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 状态提示 */}
          {statusMessage && (
            <Alert
              variant={
                status === 'error' ? 'destructive' : status === 'success' ? 'default' : 'default'
              }
            >
              <AlertTitle>
                {status === 'error' ? '登录失败' : status === 'success' ? '登录成功' : '提示'}
              </AlertTitle>
              <AlertDescription>{statusMessage}</AlertDescription>
            </Alert>
          )}

          {/* 加载中 */}
          {(!configLoaded || isBusy) && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* 登录按钮 */}
          {configLoaded && !isBusy && status !== 'success' && (
            <Button
              onClick={openLoginPopup}
              disabled={!userCenterUrl}
              className="w-full"
              size="lg"
            >
              <LogIn className="mr-2 h-4 w-4" />
              打开登录窗口
            </Button>
          )}

          {configLoaded && status === 'error' && !isBusy && (
            <Button
              onClick={openLoginPopup}
              variant="outline"
              className="w-full"
            >
              重新登录
            </Button>
          )}

          {/* 未配置提示 */}
          {configLoaded && !userCenterUrl && (
            <Alert variant="destructive">
              <AlertTitle>配置缺失</AlertTitle>
              <AlertDescription>
                未配置用户中心地址（USER_CENTER_URL），请联系管理员。
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}