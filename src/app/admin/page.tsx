'use client';

import { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import {
  ChevronRight,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Moon,
  Power,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import LoginPage from './login';
import { StationNav } from './station-nav';
import { CredentialEditor } from './credential-editor';
import { ModelTogglePanel } from './model-toggles';
import type { StationInfo } from './types';

// ---- 主题切换（Hydration 安全） ----

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === 'dark';

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isDark ? '切换到浅色模式' : '切换到深色模式'}
      title={isDark ? '切换到浅色模式' : '切换到深色模式'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

// ---- 站点身份卡 ----

function StationIdentity({ station }: { station: StationInfo }) {
  const credentialCount = station.credentials.length;
  const enabledCount = station.modelToggles.filter((m) => m.enabled).length;

  return (
    <Card className="flex flex-col gap-5 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <div
          className="flex size-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-pop"
          style={{ background: 'var(--accent-gradient)' }}
        >
          <ShieldCheck className="size-6" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-lg font-semibold tracking-tight">{station.name}</h2>
            <Badge variant="outline" className="font-mono text-[10px]">
              {station.id}
            </Badge>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {station.hasCredentialConfig && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-[11px] text-primary">
                <KeyRound className="size-3" />
                凭证配置
              </span>
            )}
            {station.hasModelToggle && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-[11px] text-primary">
                <Power className="size-3" />
                模型启停
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 gap-6 pl-16 sm:pl-0">
        <div className="text-center">
          <p className="text-lg font-semibold tabular-nums">{credentialCount}</p>
          <p className="text-xs text-muted-foreground">凭证模型</p>
        </div>
        <Separator orientation="vertical" className="hidden h-8 self-center sm:block" />
        <div className="text-center">
          <p className="text-lg font-semibold tabular-nums">
            {enabledCount}
            <span className="text-xs font-normal text-muted-foreground">
              /{station.modelToggles.length}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">模型运行</p>
        </div>
      </div>
    </Card>
  );
}

// ---- 中转站面板 ----

function StationPanel({ station }: { station: StationInfo }) {
  const hasCredentials = station.hasCredentialConfig;
  const hasToggles = station.hasModelToggle;
  const defaultTab = hasCredentials ? 'credentials' : hasToggles ? 'toggles' : 'credentials';

  if (!hasCredentials && !hasToggles) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-8 py-14 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <LayoutDashboard className="size-5" />
        </div>
        <p className="text-sm font-medium">该中转站无可配置项</p>
      </div>
    );
  }

  return (
    <Tabs defaultValue={defaultTab} className="w-full">
      <TabsList className="grid w-full max-w-sm grid-cols-2">
        {hasCredentials && <TabsTrigger value="credentials">凭证配置</TabsTrigger>}
        {hasToggles && <TabsTrigger value="toggles">模型启停</TabsTrigger>}
      </TabsList>

      {hasCredentials && (
        <TabsContent value="credentials" className="mt-5">
          <CredentialEditor station={station} />
        </TabsContent>
      )}
      {hasToggles && (
        <TabsContent value="toggles" className="mt-5">
          <ModelTogglePanel station={station} />
        </TabsContent>
      )}
    </Tabs>
  );
}

// ---- 主页面 ----

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [stations, setStations] = useState<StationInfo[]>([]);
  const [activeStationId, setActiveStationId] = useState<string | null>(null);
  const activeStationIdRef = useRef(activeStationId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 同步 ref 与 state
  useEffect(() => {
    activeStationIdRef.current = activeStationId;
  }, [activeStationId]);

  // 认证通过后加载中转站列表
  useEffect(() => {
    if (!authenticated) return;

    let cancelled = false;

    async function fetchStations() {
      setLoading(true);
      setError('');

      try {
        const res = await fetch('/api/v1/admin/stations');
        if (cancelled) return;

        if (!res.ok) {
          if (res.status === 401) {
            setAuthenticated(false);
            return;
          }
          const data = await res.json();
          setError(data.error || '加载失败');
          return;
        }

        const data = await res.json();
        if (cancelled) return;

        setStations(data.stations);
        if (data.stations.length > 0 && !activeStationIdRef.current) {
          setActiveStationId(data.stations[0].id);
        }
      } catch {
        if (!cancelled) setError('网络错误，请重试');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchStations();

    return () => {
      cancelled = true;
    };
  }, [authenticated]);

  const handleLogin = () => {
    setAuthenticated(true);
  };

  const handleLogout = () => {
    setAuthenticated(false);
    setStations([]);
    setActiveStationId(null);
  };

  if (!authenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const activeStation = stations.find((s) => s.id === activeStationId);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
          {/* Logo + 标题 */}
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-white"
              style={{ background: 'var(--accent-gradient)' }}
            >
              <ShieldCheck className="size-4" />
            </div>
            <div className="hidden min-w-0 items-center gap-1.5 text-sm sm:flex">
              <span className="font-semibold">管理控制台</span>
              {activeStation && (
                <>
                  <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate text-muted-foreground">{activeStation.name}</span>
                </>
              )}
            </div>
          </div>

          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut />
              <span className="hidden sm:inline">退出</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Body: 侧边栏 + 内容区 */}
      <div className="mx-auto flex max-w-7xl">
        {/* 桌面侧边栏 */}
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-64 shrink-0 border-r lg:block">
          <ScrollArea className="h-full">
            <div className="space-y-4 px-4 py-5">
              <div className="flex items-center justify-between px-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  中转站
                </p>
                <Badge variant="secondary" className="font-mono text-[10px]">
                  {stations.length}
                </Badge>
              </div>
              {!loading && stations.length > 0 && (
                <StationNav
                  stations={stations}
                  activeStationId={activeStationId}
                  onSelect={setActiveStationId}
                />
              )}
              {loading && (
                <div className="space-y-2 px-2">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-xl" />
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </aside>

        {/* 主内容区 */}
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6">
          {/* 移动端站点切换 */}
          {!loading && stations.length > 0 && (
            <div className="mb-5 flex gap-2 overflow-x-auto pb-1 lg:hidden">
              {stations.map((s) => (
                <Button
                  key={s.id}
                  variant={activeStationId === s.id ? 'default' : 'outline'}
                  size="sm"
                  className="shrink-0"
                  onClick={() => setActiveStationId(s.id)}
                >
                  {s.name}
                </Button>
              ))}
            </div>
          )}

          {/* 加载骨架 */}
          {loading && (
            <div className="space-y-5">
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-10 w-64 rounded-lg" />
              <Skeleton className="h-48 w-full rounded-2xl" />
            </div>
          )}

          {/* 错误 */}
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>加载失败</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* 空状态 */}
          {!loading && stations.length === 0 && !error && (
            <div className={cn('flex flex-col items-center gap-3 rounded-2xl border border-dashed px-8 py-16 text-center')}>
              <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <LayoutDashboard className="size-5" />
              </div>
              <div>
                <p className="text-sm font-medium">没有可管理的子站</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  请确认中转站已正确注册到系统
                </p>
              </div>
            </div>
          )}

          {/* 站点内容 */}
          {!loading && activeStation && (
            <div className="space-y-6">
              <StationIdentity station={activeStation} />
              <StationPanel station={activeStation} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
