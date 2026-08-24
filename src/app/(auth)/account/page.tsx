'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Crown,
  Loader2,
  LogOut,
  Shield,
  Undo2,
  User,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';

// ============ 会员等级配置 ============

const MEMBERSHIP_TIERS: Record<string, {
  label: string;
  color: 'default' | 'secondary' | 'destructive' | 'outline';
  icon: typeof Shield;
  description: string;
}> = {
  free: {
    label: '免费用户',
    color: 'secondary',
    icon: User,
    description: '基础模型访问权限',
  },
  vip: {
    label: 'VIP',
    color: 'default',
    icon: Crown,
    description: '高级模型 + 优先队列',
  },
  svip: {
    label: 'SVIP',
    color: 'destructive',
    icon: Zap,
    description: '全部模型 + 最高优先级',
  },
  admin: {
    label: '管理员',
    color: 'destructive',
    icon: Shield,
    description: '全部权限',
  },
};

/** 后端下发的会员策略（商品卡片数据源，与 src/lib/membership/strategies.ts 注册表对应） */
interface MembershipAction {
  id: string;
  label: string;
  description: string;
  targetLevel: string;
}

// ============ 组件 ============

export default function AccountPage() {
  const router = useRouter();
  const { loaded, loggedIn, user, stationToken, membership, rotateToken, logout } = useAuth();
  const [actions, setActions] = useState<MembershipAction[]>([]);
  const [loadingActions, setLoadingActions] = useState(false);
  const [executingAction, setExecutingAction] = useState<string | null>(null);
  const [error, setError] = useState('');

  // 拉取当前用户可执行的会员策略（商品卡片数据源）
  const refreshActions = useCallback(async () => {
    if (!stationToken) {
      setActions([]);
      return;
    }
    setLoadingActions(true);
    try {
      const res = await fetch('/api/v1/membership/actions', {
        headers: { Authorization: `Bearer ${stationToken}` },
      });
      if (!res.ok) {
        setActions([]);
        return;
      }
      const data = await res.json();
      setActions(data.actions ?? []);
    } catch {
      setActions([]);
    } finally {
      setLoadingActions(false);
    }
  }, [stationToken]);

  useEffect(() => {
    void refreshActions();
  }, [refreshActions]);

  // 未加载完成
  if (!loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // 未登录
  if (!loggedIn || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>需要登录</CardTitle>
            <CardDescription>请先登录以访问用户中心</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/login')}>前往登录</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentLevel = membership?.level ?? 'free';
  const tier = MEMBERSHIP_TIERS[currentLevel] ?? MEMBERSHIP_TIERS.free;
  const TierIcon = tier.icon;

  // 通用策略执行：按一下按钮 = 执行一个策略（升级 / 还原均走此路径）
  const handleAction = async (actionId: string) => {
    if (!stationToken) return;
    setExecutingAction(actionId);
    setError('');

    try {
      const res = await fetch('/api/v1/membership/upgrade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${stationToken}`,
        },
        body: JSON.stringify({ action: actionId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '操作失败');
        return;
      }

      // 无感轮换：同步新 token + 新会员等级，后续请求自动使用新凭证
      rotateToken({
        token: data.token,
        membership: {
          level: data.membershipLevel,
          permissionLevel: data.permissionLevel,
          expiresAt: data.expiresAt,
        },
      });

      // 等级已变化，刷新可执行策略列表
      void refreshActions();
    } catch {
      setError('网络错误，请重试');
    } finally {
      setExecutingAction(null);
    }
  };

  const handleLogout = () => {
    // logout 内部负责吊销 token、清本地态并跳转平台单点登出，无需此处再导航
    void logout();
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      {/* 返回 */}
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        返回首页
      </Link>

      {/* 错误提示 */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 用户信息卡片 */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-xl font-semibold text-primary">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <CardTitle className="text-xl truncate">{user.name}</CardTitle>
              <CardDescription className="truncate">{user.email}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={tier.color} className="gap-1.5 px-3 py-1 text-sm">
              <TierIcon className="h-3.5 w-3.5" />
              {tier.label}
            </Badge>
            <span className="text-sm text-muted-foreground">{tier.description}</span>
          </div>
        </CardContent>
      </Card>

      {/* 会员商品卡片框架：后端下发策略列表，每行卡片 = 一个可执行策略（升级 / 还原） */}
      <Card className="mb-6 border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Crown className="h-5 w-5 text-amber-500" />
            会员方案
          </CardTitle>
          <CardDescription>
            选择会员方案，一键执行对应策略（当前等级：{tier.label}）
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingActions ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : actions.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              当前等级暂无可用会员方案
            </p>
          ) : (
            actions.map((action) => {
              const target = MEMBERSHIP_TIERS[action.targetLevel] ?? MEMBERSHIP_TIERS.free;
              const isReset = action.targetLevel === 'free';
              const ActionIcon = isReset ? Undo2 : target.icon;
              const busy = executingAction === action.id;
              return (
                <div
                  key={action.id}
                  className="flex items-center gap-3 rounded-xl border p-4"
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                      isReset
                        ? 'bg-muted text-muted-foreground'
                        : 'bg-primary-soft text-primary'
                    }`}
                  >
                    <ActionIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{action.label}</p>
                    <p className="text-sm text-muted-foreground">{action.description}</p>
                  </div>
                  <Button
                    variant={isReset ? 'outline' : 'default'}
                    onClick={() => void handleAction(action.id)}
                    disabled={executingAction !== null}
                    className="shrink-0"
                  >
                    {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {busy ? '处理中...' : action.label}
                  </Button>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* 操作按钮 */}
      <Button
        variant="outline"
        onClick={handleLogout}
        className="w-full"
      >
        <LogOut className="mr-2 h-4 w-4" />
        退出登录
      </Button>
    </div>
  );
}