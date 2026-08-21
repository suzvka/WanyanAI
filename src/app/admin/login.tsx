'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTheme } from 'next-themes';
import { LockKeyhole, Moon, ShieldCheck, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// ---- 主题切换（Hydration 安全） ----

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const isDark = mounted && resolvedTheme === 'dark';

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isDark ? '切换到浅色模式' : '切换到深色模式'}
      title={isDark ? '切换到浅色模式' : '切换到深色模式'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="rounded-full"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

// ---- 登录页 ----

export default function LoginPage({ onLogin }: { onLogin: (token: string) => void }) {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/v1/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || '验证失败');
        return;
      }

      onLogin(token);
    } catch {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      {/* 背景装饰：柔和渐变 + 光斑 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60 dark:opacity-40"
        style={{
          background:
            'radial-gradient(60% 50% at 50% 0%, color-mix(in oklab, var(--theme-primary) 12%, transparent) 0%, transparent 100%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 -top-32 size-96 rounded-full opacity-20 blur-3xl dark:opacity-25"
        style={{ background: 'var(--accent-gradient)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -left-32 size-96 rounded-full opacity-15 blur-3xl dark:opacity-20"
        style={{ background: 'var(--accent-gradient)' }}
      />

      <div className="absolute right-4 top-4 flex items-center gap-1">
        <ThemeToggle />
      </div>

      <div className="relative w-full max-w-md">
        <div className="rounded-3xl border bg-card shadow-pop">
          <div className="flex flex-col items-center gap-4 border-b px-8 py-10 text-center">
            {/* 品牌图标 */}
            <div
              className="flex size-14 items-center justify-center rounded-2xl text-white shadow-pop"
              style={{ background: 'var(--accent-gradient)' }}
            >
              <ShieldCheck className="size-7" />
            </div>
            <div className="space-y-1.5">
              <h1 className="text-xl font-semibold tracking-tight">管理控制台</h1>
              <p className="text-sm text-muted-foreground">
                请输入访问令牌以继续管理中转站配置
              </p>
            </div>
          </div>

          <div className="px-8 py-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="token" className="text-sm font-medium">
                  访问令牌
                </Label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="token"
                    type="password"
                    placeholder="输入 Admin Token"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="pl-9"
                    autoFocus
                  />
                </div>
              </div>

              {error && (
                <Alert variant="destructive" className="py-3">
                  <AlertTitle className="text-sm">验证失败</AlertTitle>
                  <AlertDescription className="text-xs">{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" size="lg" disabled={loading || !token.trim()}>
                {loading ? '正在验证...' : '进入管理'}
              </Button>
            </form>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          仅限授权管理员访问 · 会话令牌由服务器签名，请妥善保管
        </p>
      </div>
    </div>
  );
}
