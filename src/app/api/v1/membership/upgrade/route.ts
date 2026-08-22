/**
 * POST /api/v1/membership/upgrade
 *
 * 通用「会员策略执行器」：按 action（策略 id）对当前用户换发 token。
 *
 * 设计原则：
 * - 「往 token 上绑定哪些内容」由策略注册表（src/lib/membership/strategies.ts）声明，
 *   本接口不硬编码任何「升一级 / 降一级 / 还原」业务动作；
 * - 升级/降级/还原的适用性由各策略自行校验（isApplicable），无全局升降级限制；
 * - 换发顺序：先签发新 token，再吊销旧 token（吊销失败不阻塞），保证任何时刻会话不受损。
 */
import { NextRequest, NextResponse } from 'next/server';
import { introspectToken, revokeToken, issueToken, getProductId } from '@/lib/auth-center';
import { getMembershipStrategy, getPermissionLevelFor } from '@/lib/membership/strategies';
import { createLogger } from '@/lib/api-station/logger';

const logger = createLogger('Membership');

// ============ 类型 ============

interface ActionRequest {
  action?: string;
}

// ============ 路由处理 ============

export async function POST(req: NextRequest) {
  try {
    // 提取并验证 token
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return NextResponse.json({ error: '未提供访问凭证' }, { status: 401 });
    }

    // 解析请求体
    const body: ActionRequest = await req.json().catch(() => ({}));
    const { action } = body;

    // 策略必须存在（框架：按钮 = 策略 id）
    const strategy = action ? getMembershipStrategy(action) : undefined;
    if (!strategy) {
      return NextResponse.json({ error: '无效的会员策略' }, { status: 400 });
    }

    // 校验当前 token
    const introspect = await introspectToken({ token });

    if (!introspect.active) {
      return NextResponse.json({ error: '凭证已失效，请重新登录' }, { status: 401 });
    }

    const userId = introspect.userId;
    const currentClaims = introspect.claims ?? {};
    const currentLevel = (currentClaims.membershipLevel as string) ?? 'free';

    // 策略适用性校验（升级/降级/还原由策略自行声明）
    if (!strategy.isApplicable(currentLevel)) {
      return NextResponse.json(
        { error: `当前等级 ${currentLevel} 不适用策略「${strategy.label}」` },
        { status: 400 },
      );
    }

    // 目标与当前相同（防御：策略应通过 isApplicable 排除，这里兜底）
    if (strategy.targetLevel === currentLevel) {
      return NextResponse.json(
        { error: `已是 ${currentLevel} 会员，无需重复操作` },
        { status: 400 },
      );
    }

    logger.info('执行会员策略', {
      userId,
      action: strategy.id,
      from: currentLevel,
      to: strategy.targetLevel,
    });

    // 由策略计算新 claims（token 绑定内容的唯一出口）
    const newClaims = strategy.apply(currentClaims);

    // 先签发新 token，再吊销旧 token（吊销失败不阻塞，签发成功即会话安全）
    const issued = await issueToken({
      userId,
      productId: getProductId(),
      claims: newClaims,
    });

    try {
      await revokeToken({ token, productId: getProductId() });
    } catch (revokeErr) {
      logger.warn('旧 token 吊销失败（新 token 已签发，可忽略）', {
        userId,
        detail: revokeErr instanceof Error ? revokeErr.message : '未知错误',
      });
    }

    const permissionLevel = getPermissionLevelFor(strategy.targetLevel);

    return NextResponse.json({
      success: true,
      action: strategy.id,
      token: issued.token,
      membershipLevel: strategy.targetLevel,
      permissionLevel,
      expiresAt: issued.expiresAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    logger.error('执行会员策略失败', err instanceof Error ? err : null, { message });
    return NextResponse.json(
      { error: `操作失败，请稍后重试: ${message}` },
      { status: 500 },
    );
  }
}
