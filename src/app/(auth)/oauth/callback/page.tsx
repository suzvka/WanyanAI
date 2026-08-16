'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

/**
 * OAuth 2.0 回调处理页面
 *
 * 云洲用户授权后 302 回跳至此页，携带 code + state。
 * 流程：
 * 1. 读取 URL 中的 code 和 state
 * 2. 校验 state 是否与发起时一致（防 CSRF）
 * 3. 读取 localStorage 中的 code_verifier
 * 4. 调用后端 POST /api/v1/oauth/callback 交换 code → station token
 * 5. 将 station token 写入 sessionStorage
 * 6. 跳转首页
 *
 * 注意：使用 localStorage 而非 sessionStorage 存储 PKCE 参数，
 * 因为 OAuth 弹窗/新窗口是独立上下文，sessionStorage 不共享。
 */

const OAUTH_STORAGE_KEY = 'oauth_pkce_state';
const OAUTH_VERIFIER_KEY = 'oauth_code_verifier';

function OAuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // 云洲返回错误（如用户拒绝授权）
    if (error) {
      const errorDesc = searchParams.get('error_description') || '用户取消了授权';
      setStatus('error');
      setErrorMessage(decodeURIComponent(errorDesc));
      return;
    }

    if (!code) {
      setStatus('error');
      setErrorMessage('未收到授权码，请重新登录');
      return;
    }

    // 校验 state（防 CSRF）
    // 使用 localStorage 而非 sessionStorage，因为 OAuth 弹窗是独立上下文，
    // sessionStorage 在弹窗与主窗口间不共享，但 localStorage 是同源共享的。
    let savedState = localStorage.getItem(OAUTH_STORAGE_KEY);
    let codeVerifier = localStorage.getItem(OAUTH_VERIFIER_KEY);

    // 兼容旧版：sessionStorage 兜底（登录页旧代码仍可能写入 sessionStorage）
    if (!savedState || !codeVerifier) {
      savedState = sessionStorage.getItem(OAUTH_STORAGE_KEY);
      codeVerifier = sessionStorage.getItem(OAUTH_VERIFIER_KEY);
    }

    if (!savedState || !codeVerifier) {
      setStatus('error');
      setErrorMessage('登录会话已过期，请重新登录');
      return;
    }

    if (state !== savedState) {
      setStatus('error');
      setErrorMessage('登录状态校验失败，请重新登录（可能遭受 CSRF 攻击）');
      return;
    }

    // 清理临时存储（两种都清，兼容新旧）
    localStorage.removeItem(OAUTH_STORAGE_KEY);
    localStorage.removeItem(OAUTH_VERIFIER_KEY);
    sessionStorage.removeItem(OAUTH_STORAGE_KEY);
    sessionStorage.removeItem(OAUTH_VERIFIER_KEY);

    // 调用后端完成令牌交换
    const redirectUri = `${window.location.origin}/oauth/callback`;

    fetch('/api/v1/oauth/callback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri,
      }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || '登录失败');
        }

        // 存储 station token 到 sessionStorage
        sessionStorage.setItem('station_token', data.token);
        sessionStorage.setItem('station_user', JSON.stringify(data.user));
        sessionStorage.setItem('station_membership', JSON.stringify(data.membership));

        // 跳转首页
        router.replace('/');
      })
      .catch((err) => {
        setStatus('error');
        setErrorMessage(err.message || '网络异常，请稍后重试');
      });
  }, [searchParams, router]);

  if (status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="mx-auto max-w-md text-center">
          <div className="mb-4 text-4xl">⚠️</div>
          <h1 className="mb-2 text-xl font-semibold">登录失败</h1>
          <p className="mb-6 text-muted-foreground">{errorMessage}</p>
          <button
            onClick={() => router.replace('/login')}
            className="rounded-lg bg-primary px-6 py-2 text-primary-foreground hover:opacity-90"
          >
            重新登录
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mb-4">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
        <p className="text-muted-foreground">正在完成登录...</p>
      </div>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="mt-4 text-muted-foreground">正在加载...</p>
          </div>
        </div>
      }
    >
      <OAuthCallbackInner />
    </Suspense>
  );
}