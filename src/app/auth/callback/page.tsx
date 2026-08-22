'use client';

/**
 * /auth/callback — OAuth 授权回调页（弹窗内加载）
 *
 * 平台认证服务授权完成后 302 回跳本页（携带 code/state 或 error），
 * 本页仅把回调参数通过 postMessage 转交主窗口（opener），随后自动关闭。
 * 不在本页发起任何 token 交换（code_verifier 由主窗口持有，避免经 URL/页面传递）。
 *
 * 消息约定：
 *   { type: 'wanyanai:oauth:callback', payload: { code?, state?, error? } }
 *   targetOrigin = window.location.origin（同源，仅主窗口可接收）
 */
import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<CallbackFallback />}>
      <CallbackContent />
    </Suspense>
  );
}

function CallbackFallback() {
  return <CallbackHint />;
}

function CallbackContent() {
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

function CallbackHint() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <p className="text-sm text-muted-foreground">正在返回主窗口...</p>
    </div>
  );
}
