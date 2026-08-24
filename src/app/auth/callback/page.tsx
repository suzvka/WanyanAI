'use client';

/**
 * /auth/callback — OAuth 回调页（同时处理「授权回调」与「登出回跳」两种场景）
 *
 * 复用同一白名单地址（OIDC 允许登出回跳复用授权回调白名单内的地址，零凭证改动）。
 * 凭 URL 参数区分场景：
 *   - 授权回调：必带 code（成功）或 error（取消/失败），在弹窗/iframe 中加载，
 *     本页将参数经 postMessage 转交主窗口（opener/parent）后自动关闭，
 *     不发起任何 token 交换（code_verifier 由主窗口持有，避免经 URL/页面传递）。
 *   - 登出回跳：仅带 state（无 code/error），为顶层整页导航，展示「已安全退出」
 *     并引导重新登录/回首页；校验 state 防伪造后清除暂存的登出 state。
 *     ⚠️ 该场景不可调用 window.close()，否则会关闭登出后的整个标签页。
 *
 * 消息约定（授权回调）：
 *   { type: 'wanyanai:oauth:callback', payload: { code?, state?, error? } }
 *   targetOrigin = window.location.origin（同源，仅主窗口可接收）
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

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<CallbackHint />}>
      <CallbackContent />
    </Suspense>
  );
}

function CallbackContent() {
  const searchParams = useSearchParams();
  const hasAuthorization = Boolean(searchParams.get('code') || searchParams.get('error'));

  // 授权回调（有 code/error）走弹窗回传；否则视为登出回跳（顶层导航）
  return hasAuthorization ? <OAuthReturnEffect /> : <LogoutReturnView />;
}

/** 授权回调：把 code/state/error 回传主窗口（opener/parent），随后自动关闭 */
function OAuthReturnEffect() {
  const searchParams = useSearchParams();
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  useEffect(() => {
    const payload = { code, state, error };
    const targetOrigin = window.location.origin;

    if (window.opener && !window.opener.closed) {
      // 弹窗模式：通过 opener 通信
      window.opener.postMessage({ type: 'wanyanai:oauth:callback', payload }, targetOrigin);
    } else {
      // iframe 模式（兜底）：通过 parent 通信
      window.parent.postMessage({ type: 'wanyanai:oauth:callback', payload }, targetOrigin);
    }

    // 通知完成即关闭窗口（主窗口收到消息后自行处理）
    window.close();
  }, [code, state, error]);

  return <CallbackHint />;
}

/** 登出回跳：校验 state 并展示「已安全退出」（顶层导航，不可 close） */
function LogoutReturnView() {
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

function CallbackHint() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <p className="text-sm text-muted-foreground">正在处理，请稍候...</p>
    </div>
  );
}