'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Crown,
  Loader2,
  LogOut,
  Shield,
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
  nextTier: string | null;
  nextLabel: string;
}> = {
  free: {
    label: '免费用户',
    color: 'secondary',
    icon: User,
    description: '基础模型访问权限',
    nextTier: 'vip',
    nextLabel: '升级到 VIP',
  },
  vip: {
    label: 'VIP',
    color: 'default',
    icon: Crown,
    description: '高级模型 + 优先队列',
    nextTier: 'svip',
    nextLabel: '升级到 SVIP',
  },
  svip: {
    label: 'SVIP',
    color: 'destructive',
    icon: Zap,
    description: '全部模型 + 最高优先级',
    nextTier: null,
    nextLabel: '',
  },
  admin: {
    label: '管理员',
    color: 'destructive',
    icon: Shield,
    description: '全部权限',
    nextTier: null,
    nextLabel: '',
  },
};

// ============ 组件 ============

export default function AccountPage() {
  const router = useRouter();
  const { loaded, loggedIn, user, stationToken, membership, rotateToken, logout } = useAuth();
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState('');

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

  const handleUpgrade = async () => {
    if (!tier.nextTier || !stationToken) return;
    setUpgrading(true);
    setError('');

    try {
      const res = await fetch('/api/v1/membership/upgrade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${stationToken}`,
        },
        body: JSON.stringify({ level: tier.nextTier }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '升级失败');
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
    } catch {
      setError('网络错误，请重试');
    } finally {
      setUpgrading(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/');
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

      {/* 会员升级卡片 */}
      {tier.nextTier && (
        <Card className="mb-6 border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Crown className="h-5 w-5 text-amber-500" />
              升级会员
            </CardTitle>
            <CardDescription>
              升级到 {MEMBERSHIP_TIERS[tier.nextTier]?.label}，解锁更多模型和更高优先级
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleUpgrade}
              disabled={upgrading}
              className="w-full"
              size="lg"
            >
              {upgrading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  处理中...
                </>
              ) : (
                tier.nextLabel
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 已是最高等级 */}
      {!tier.nextTier && currentLevel !== 'admin' && (
        <Card className="mb-6">
          <CardContent className="py-6 text-center">
            <Zap className="mx-auto mb-3 h-8 w-8 text-amber-500" />
            <p className="text-lg font-medium">已是最高等级会员</p>
            <p className="text-sm text-muted-foreground mt-1">享受全部模型和最高优先级</p>
          </CardContent>
        </Card>
      )}

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