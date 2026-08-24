'use client';

/**
 * /auth/logout-callback — 平台单点登出回调页
 *
 * 平台登出端点（GET /api/oauth/logout）销毁平台会话后 302 回跳本页（携带 state）。
 * 本页职责：
 *   1. 校验 state 与登出发起时暂存的值是否一致（防伪造）
 *   2. 清除暂存 state，展示「已安全退出」并引导重新登录/回首页
 *
 * 幂等语义：未登录直接访问、state 缺失或不一致均正常展示（本地登录态已清，
 * 无副作用）。校验失败时静默处理，不向用户暴露细节。
 */
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { CheckCircle2, Home, LogIn } from 'lucide-react';
import { LOGOUT_STATE_KEY } from '@/hooks/useAuth';

export default function LogoutCallbackPage() {
  return (
    <Suspense fallback={<LogoutHint />}>
      <LogoutContent />
    </Suspense>
  );
}

function LogoutHint() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <p className="text-sm text-muted-foreground">正在处理退出...</p>
    </div>
  );
}

function LogoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [verified, setVerified] = useState(false);

  // 校验 state（防伪造），仅首帧执行一次
  useEffect(() => {
    const state = searchParams.get('state');
    const stored = sessionStorage.getItem(LOGOUT_STATE_KEY);
    sessionStorage.removeItem(LOGOUT_STATE_KEY);
    setVerified(Boolean(state && stored && state === stored));
  }, [searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft">
            <CheckCircle2 className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-2xl">您已安全退出</CardTitle>
          <CardDescription>
            本站登录凭证已吊销，平台登录会话已销毁，下次登录需重新输入账号密码。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button className="w-full" size="lg" onClick={() => router.push('/login')}>
            <LogIn className="mr-2 h-4 w-4" />
            重新登录
          </Button>
          <Button variant="outline" className="w-full" onClick={() => router.push('/')}>
            <Home className="mr-2 h-4 w-4" />
            返回首页
          </Button>
          {!verified && (
            <p className="text-center text-xs text-muted-foreground">
              退出状态校验未通过，但本地登录态已清除，可放心操作。
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
