'use client';

/**
 * /login — 平台认证登录页（OAuth 2.0 授权码 + PKCE，弹窗模式）
 *
 * 流程：
 *   1. 生成 PKCE（code_verifier + S256 challenge）与 state，暂存 sessionStorage（oauth_pending）
 *   2. 弹窗打开平台认证服务 /oauth/authorize（redirect_uri = 本服务 /auth/callback）
 *   3. 用户登录授权后回跳 /auth/callback，回调页 postMessage 回传 code + state
 *   4. 本页校验 origin（同源）与 state，POST /api/v1/auth/issue 换 station token
 *   5. 写入 sessionStorage 并跳转首页
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Loader2, LogIn } from 'lucide-react';

// ============ 类型 ============

interface PostMessageEvent {
  type: string;
  payload?: {
    code?: string;
    state?: string;
    error?: string;
  };
}

/** 暂存的 OAuth 待处理状态（弹窗打开前写入，回调后清除） */
interface PendingOAuth {
  codeVerifier: string;
  state: string;
}

type LoginStatus = 'idle' | 'loading' | 'issuing' | 'success' | 'error';

// ============ 常量 ============

const POPUP_WIDTH = 480;
const POPUP_HEIGHT = 640;

const PENDING_KEY = 'oauth_pending';

// ============ PKCE 工具 ============

const PKCE_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

function randomString(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => PKCE_CHARSET[b % PKCE_CHARSET.length]).join('');
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** 生成 code_verifier（43~128 字符，RFC 7636） */
function generateCodeVerifier(): string {
  return randomString(64);
}

/** 生成 S256 code_challenge */
async function generateCodeChallenge(verifier: string): Promise<string> {
  if (!crypto.subtle) {
    throw new Error('当前浏览器不支持 PKCE（crypto.subtle 不可用）');
  }
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64UrlEncode(digest);
}

/** 生成 state（防 CSRF） */
function generateState(): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)).buffer);
}

// ============ 组件 ============

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const popupRef = useRef<Window | null>(null);
  const [status, setStatus] = useState<LoginStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [platformAuthUrl, setPlatformAuthUrl] = useState('');
  const [oauthClientId, setOauthClientId] = useState('');
  const [configLoaded, setConfigLoaded] = useState(false);

  // 加载运行时配置（避免 NEXT_PUBLIC_* 构建时内联问题）
  useEffect(() => {
    fetch('/api/v1/config')
      .then((r) => r.json())
      .then((cfg) => {
        setPlatformAuthUrl(cfg.platformAuthUrl || '');
        setOauthClientId(cfg.oauthClientId || '');
        setConfigLoaded(true);
      })
      .catch(() => {
        setConfigLoaded(true);
      });
  }, []);

  // 签发 station token（携带 OAuth 授权码 + PKCE verifier）
  const issueToken = useCallback(
    async (code: string, codeVerifier: string, redirectUri: string) => {
      setStatus('issuing');
      setStatusMessage('正在签发访问凭证...');

      const res = await fetch('/api/v1/auth/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, codeVerifier, redirectUri }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setStatus('error');
        setStatusMessage(data.error || '签发凭证失败');
        return;
      }

      // 统一经 useAuth.login 写入（内部更新模块缓存并持久化 sessionStorage），
      // 保证 SPA 跳转后全局壳（AppShell）立即感知登录态，无需刷新页面
      login(
        data.token,
        data.user,
        data.membership
          ? { membershipLevel: data.membershipLevel, expiresAt: data.expiresAt }
          : undefined,
      );

      setStatus('success');
      setStatusMessage(`登录成功！欢迎回来，${data.user?.name || ''}`);

      setTimeout(() => router.push('/'), 800);
    },
    [login, router],
  );

  // 监听 postMessage（来自同源回调页 /auth/callback）
  const handleMessage = useCallback(
    (e: MessageEvent<PostMessageEvent>) => {
      // 仅接受同源回调消息（回调页与主窗口同源）
      if (e.origin !== window.location.origin) return;

      const { type, payload } = e.data;
      if (type !== 'wanyanai:oauth:callback' || !payload) return;

      // 关闭弹窗（无论成败）
      popupRef.current?.close();
      popupRef.current = null;

      // 授权被拒绝（access_denied 等）
      if (payload.error) {
        setStatus('error');
        setStatusMessage(payload.error === 'access_denied' ? '您已取消授权' : payload.error);
        return;
      }

      if (!payload.code || !payload.state) return;

      // state 校验（防授权码注入）：与打开弹窗前生成的值比对
      let pending: PendingOAuth | null = null;
      try {
        const raw = sessionStorage.getItem(PENDING_KEY);
        pending = raw ? (JSON.parse(raw) as PendingOAuth) : null;
      } catch {
        pending = null;
      }

      sessionStorage.removeItem(PENDING_KEY);

      if (!pending || pending.state !== payload.state) {
        setStatus('error');
        setStatusMessage('登录状态校验失败，请重试');
        return;
      }

      issueToken(
        payload.code,
        pending.codeVerifier,
        `${window.location.origin}/auth/callback`,
      );
    },
    [issueToken],
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
        sessionStorage.removeItem(PENDING_KEY);
        if (status === 'loading') {
          setStatus('idle');
          setStatusMessage('');
        }
      }
    }, 500);
    return () => clearInterval(timer);
  }, [status]);

  // 打开 OAuth 授权弹窗
  const openOAuthPopup = useCallback(async () => {
    if (!platformAuthUrl || !oauthClientId) {
      setStatus('error');
      setStatusMessage('未配置平台认证服务，请联系管理员');
      return;
    }

    try {
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);
      const state = generateState();

      // 暂存 verifier + state（仅主窗口 sessionStorage，弹窗内不可读）
      sessionStorage.setItem(
        PENDING_KEY,
        JSON.stringify({ codeVerifier, state } satisfies PendingOAuth),
      );

      const authorizeUrl = new URL(`${platformAuthUrl}/oauth/authorize`);
      authorizeUrl.searchParams.set('response_type', 'code');
      authorizeUrl.searchParams.set('client_id', oauthClientId);
      authorizeUrl.searchParams.set('redirect_uri', `${window.location.origin}/auth/callback`);
      authorizeUrl.searchParams.set('scope', 'openid profile email');
      authorizeUrl.searchParams.set('state', state);
      authorizeUrl.searchParams.set('code_challenge', codeChallenge);
      authorizeUrl.searchParams.set('code_challenge_method', 'S256');

      setStatus('loading');
      setStatusMessage('请在新窗口中完成登录...');

      const left = window.screenX + (window.outerWidth - POPUP_WIDTH) / 2;
      const top = window.screenY + (window.outerHeight - POPUP_HEIGHT) / 2;

      popupRef.current = window.open(
        authorizeUrl.toString(),
        'login-popup',
        `width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top}`,
      );

      if (!popupRef.current) {
        sessionStorage.removeItem(PENDING_KEY);
        setStatus('error');
        setStatusMessage('弹窗被浏览器拦截，请允许弹窗后重试');
      }
    } catch {
      sessionStorage.removeItem(PENDING_KEY);
      setStatus('error');
      setStatusMessage('当前浏览器不支持安全登录，请更换浏览器后重试');
    }
  }, [platformAuthUrl, oauthClientId]);

  const isBusy = status === 'loading' || status === 'issuing';
  const configReady = Boolean(platformAuthUrl && oauthClientId);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">登录</CardTitle>
          <CardDescription>使用您的云洲平台账户登录以继续</CardDescription>
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
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* 登录按钮 */}
          {configLoaded && !isBusy && status !== 'success' && (
            <Button
              onClick={openOAuthPopup}
              disabled={!configReady}
              className="w-full"
              size="lg"
            >
              <LogIn className="mr-2 h-4 w-4" />
              打开登录窗口
            </Button>
          )}

          {configLoaded && status === 'error' && !isBusy && (
            <Button
              onClick={openOAuthPopup}
              variant="outline"
              className="w-full"
            >
              重新登录
            </Button>
          )}

          {/* 未配置提示 */}
          {configLoaded && !configReady && (
            <Alert variant="destructive">
              <AlertTitle>配置缺失</AlertTitle>
              <AlertDescription>
                未配置平台认证服务（PLATFORM_AUTH_URL / AUTH_CENTER_API_KEY），请联系管理员。
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
