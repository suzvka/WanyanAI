'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Loader2, LogIn } from 'lucide-react';

// ============ PKCE 工具函数 ============

/** 生成 N 位随机字符串（43~128） */
function generateCodeVerifier(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const length = 64 + Math.floor(Math.random() * 32); // 64~95
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => chars[byte % chars.length]).join('');
}

/** Base64URL 编码（无填充） */
function base64URLEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** 计算 S256 code_challenge */
async function computeCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64URLEncode(digest);
}

/** 生成随机 state（CSRF 令牌） */
function generateState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64URLEncode(array.buffer);
}

// ============ 常量 ============

const OAUTH_STORAGE_KEY = 'oauth_pkce_state';
const OAUTH_VERIFIER_KEY = 'oauth_code_verifier';

// ============ 组件 ============

export default function LoginPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [oauthConfig, setOAuthConfig] = useState<{
    authorizeUrl: string;
    clientId: string;
    redirectUri: string;
  } | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);

  // 加载 OAuth 运行时配置
  useEffect(() => {
    fetch('/api/v1/config')
      .then((r) => r.json())
      .then((cfg) => {
        const providerUrl = cfg.oauthProviderUrl || '';
        const clientId = cfg.oauthClientId || '';

        if (providerUrl && clientId) {
          const baseUrl = providerUrl.replace(/\/$/, '');
          setOAuthConfig({
            authorizeUrl: `${baseUrl}/oauth/authorize`,
            clientId,
            redirectUri: `${window.location.origin}/oauth/callback`,
          });
        }
        setConfigLoaded(true);
      })
      .catch(() => {
        setConfigLoaded(true);
      });
  }, []);

  // 发起 OAuth 登录
  const startOAuthLogin = useCallback(async () => {
    if (!oauthConfig) {
      setStatus('error');
      setStatusMessage('未配置 OAuth 认证服务，请联系管理员');
      return;
    }

    setStatus('loading');
    setStatusMessage('正在跳转到认证中心...');

    try {
      // 1. 生成 PKCE 参数
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await computeCodeChallenge(codeVerifier);
      const state = generateState();

      // 2. 存储到 localStorage（回调页读取）
      // 使用 localStorage 而非 sessionStorage，因为 OAuth 弹窗是独立上下文，
      // sessionStorage 不共享，但 localStorage 在同源窗口间共享。
      localStorage.setItem(OAUTH_VERIFIER_KEY, codeVerifier);
      localStorage.setItem(OAUTH_STORAGE_KEY, state);

      // 3. 构造 OAuth 授权 URL
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: oauthConfig.clientId,
        redirect_uri: oauthConfig.redirectUri,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        state,
      });

      // 4. 302 跳转
      window.location.href = `${oauthConfig.authorizeUrl}?${params.toString()}`;
    } catch (err) {
      setStatus('error');
      setStatusMessage('启动登录失败，请重试');
    }
  }, [oauthConfig]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">登录</CardTitle>
          <CardDescription>使用云洲账号登录以继续</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 状态提示 */}
          {statusMessage && (
            <Alert variant={status === 'error' ? 'destructive' : 'default'}>
              <AlertTitle>
                {status === 'error' ? '登录失败' : '提示'}
              </AlertTitle>
              <AlertDescription>{statusMessage}</AlertDescription>
            </Alert>
          )}

          {/* 加载中 */}
          {!configLoaded && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* 登录按钮 */}
          {configLoaded && status !== 'loading' && (
            <Button
              onClick={startOAuthLogin}
              disabled={!oauthConfig}
              className="w-full"
              size="lg"
            >
              <LogIn className="mr-2 h-4 w-4" />
              使用云洲账号登录
            </Button>
          )}

          {/* 加载中状态 */}
          {configLoaded && status === 'loading' && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">正在跳转...</span>
            </div>
          )}

          {/* 未配置提示 */}
          {configLoaded && !oauthConfig && (
            <Alert variant="destructive">
              <AlertTitle>配置缺失</AlertTitle>
              <AlertDescription>
                未配置 OAuth 认证服务（OAUTH_CLIENT_ID / OAUTH_PROVIDER_URL），请联系管理员。
              </AlertDescription>
            </Alert>
          )}

          {/* 重新登录按钮 */}
          {configLoaded && status === 'error' && oauthConfig && (
            <Button
              onClick={startOAuthLogin}
              variant="outline"
              className="w-full"
            >
              重新登录
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}