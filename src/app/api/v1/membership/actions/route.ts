/**
 * GET /api/v1/membership/actions
 *
 * 下发当前登录用户可执行的会员策略列表（商品卡片框架的数据源）。
 * 前端按钮/卡片与策略 id 一一绑定，点击后调用 POST /api/v1/membership/upgrade 执行。
 * 新增商品只需在 src/lib/membership/strategies.ts 注册策略，前端自动出现对应卡片。
 */
import { NextRequest, NextResponse } from 'next/server';
import { introspectToken } from '@/lib/auth-center';
import { getApplicableStrategies } from '@/lib/membership/strategies';

export async function GET(req: NextRequest) {
  // 提取并验证 token
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return NextResponse.json({ error: '未提供访问凭证' }, { status: 401 });
  }

  const introspect = await introspectToken({ token });

  if (!introspect.active) {
    return NextResponse.json({ error: '凭证已失效，请重新登录' }, { status: 401 });
  }

  const currentLevel = (introspect.claims?.membershipLevel as string) ?? 'free';

  const actions = getApplicableStrategies(currentLevel).map((s) => ({
    id: s.id,
    label: s.label,
    description: s.description,
    targetLevel: s.targetLevel,
  }));

  return NextResponse.json({ currentLevel, actions });
}
