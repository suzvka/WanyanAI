'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

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

type LoginStatus = 'idle' | 'loading' | 'ready' | 'success' | 'error';

// ============ 常量 ============

const USER_CENTER_ORIGIN = process.env.NEXT_PUBLIC_USER_CENTER_URL || '';
const IFRAME_SRC = `${USER_CENTER_ORIGIN}/embed/sign-in`;

// ============ 组件 ============

export default function LoginPage() {
  const router = useRouter();
  const [status, setStatus] = useState<LoginStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [iframeReady, setIframeReady] = useState(false);

  // 处理 postMessage 事件
  const handleMessage = useCallback(
    async (e: MessageEvent<PostMessageEvent>) => {
      // 安全校验：只信任用户中心域名
      if (!USER_CENTER_ORIGIN || e.origin !== USER_CENTER_ORIGIN) return;

      const { type, payload } = e.data;
      if (!type) return;

      switch (type) {
        case 'auth:iframe:ready':
          setIframeReady(true);
          setStatus('ready');
          break;

        case 'auth:sign-in:success': {
          if (!payload?.token || !payload?.user) return;

          setStatus('loading');
          setStatusMessage('正在签发访问凭证...');

          try {
            const res = await fetch('/api/v1/auth/issue', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                accountToken: payload.token,
                user: payload.user,
              }),
            });

            const data = await res.json();

            if (!res.ok) {
              setStatus('error');
              setStatusMessage(data.error || '签发凭证失败');
              return;
            }

            // 存储 token 和用户信息到 sessionStorage
            sessionStorage.setItem('station_token', data.token);
            sessionStorage.setItem('station_user', JSON.stringify(payload.user));
            if (data.membership) {
              sessionStorage.setItem('station_membership', JSON.stringify({
                level: data.membershipLevel,
                permissionLevel: data.permissionLevel,
                expiresAt: data.expiresAt,
              }));
            }
            setStatus('success');
            setStatusMessage(`登录成功！欢迎回来，${payload.user.name}`);

            // 跳转到首页
            setTimeout(() => {
              router.push('/');
            }, 800);
          } catch {
            setStatus('error');
            setStatusMessage('网络错误，请重试');
          }
          break;
        }

        case 'auth:sign-in:error':
          setStatus('error');
          setStatusMessage(payload?.message || '登录失败');
          break;
      }
    },
    [router],
  );

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

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
          {status === 'loading' && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* 登录 iframe */}
          {(status === 'idle' || status === 'ready' || status === 'error') && (
            <div className="relative">
              {!iframeReady && status !== 'error' && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/80">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
              <div className="overflow-hidden rounded-xl border shadow-sm">
                <iframe
                  id="login-frame"
                  src={IFRAME_SRC}
                  width="100%"
                  height="480"
                  style={{ border: 'none', display: 'block' }}
                  title="登录"
                  sandbox="allow-scripts allow-same-origin allow-forms"
                />
              </div>
            </div>
          )}

          {/* 未配置提示 */}
          {!USER_CENTER_ORIGIN && (
            <Alert variant="destructive">
              <AlertTitle>配置缺失</AlertTitle>
              <AlertDescription>
                未配置用户中心地址（NEXT_PUBLIC_USER_CENTER_URL），请联系管理员。
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}