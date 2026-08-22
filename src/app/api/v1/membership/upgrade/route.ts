import { NextRequest, NextResponse } from 'next/server';
import { introspectToken, revokeToken, issueToken, getProductId } from '@/lib/auth-center';
import { createLogger } from '@/lib/api-station/logger';

const logger = createLogger('Membership');

// ============ 类型 ============

interface UpgradeRequest {
  level: string;
}

// ============ 会员等级映射 ============

const ALLOWED_LEVELS = ['free', 'vip', 'svip'];

const MEMBERSHIP_TO_PERMISSION: Record<string, number> = {
  free: 1,
  vip: 2,
  svip: 3,
};

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
    const body: UpgradeRequest = await req.json().catch(() => ({} as UpgradeRequest));
    const { level } = body;

    if (!level || !ALLOWED_LEVELS.includes(level)) {
      return NextResponse.json(
        { error: `无效的会员等级，可选值: ${ALLOWED_LEVELS.join(', ')}` },
        { status: 400 },
      );
    }

    // 校验当前 token
    const introspect = await introspectToken({ token });

    if (!introspect.active) {
      return NextResponse.json({ error: '凭证已失效，请重新登录' }, { status: 401 });
    }

    const userId = introspect.userId;
    const currentClaims = introspect.claims ?? {};
    const currentLevel = (currentClaims.membershipLevel as string) ?? 'free';

    // 不允许降级
    const currentPermission = MEMBERSHIP_TO_PERMISSION[currentLevel] ?? 1;
    const targetPermission = MEMBERSHIP_TO_PERMISSION[level] ?? 1;
    if (targetPermission < currentPermission) {
      return NextResponse.json(
        { error: `不支持降级：当前 ${currentLevel}，目标 ${level}` },
        { status: 400 },
      );
    }

    // 同等级无需升级
    if (targetPermission === currentPermission) {
      return NextResponse.json(
        { error: `已是 ${currentLevel} 会员，无需重复操作` },
        { status: 400 },
      );
    }

    logger.info('会员升级', {
      userId,
      from: currentLevel,
      to: level,
    });

    // 先签发新 token（带新会员等级），再吊销旧 token。
    // 顺序保证：即使签发失败，旧 token 仍有效，现有会话不受影响（无感化关键）；
    // 鉴权中心对同一 (userId, productId) 重复签发会替换旧 token，
    // 因此吊销失败也不阻塞升级（仅记录日志）。
    const newClaims = {
      ...currentClaims,
      membershipLevel: level,
    };

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

    return NextResponse.json({
      success: true,
      token: issued.token,
      membershipLevel: level,
      permissionLevel: targetPermission,
      expiresAt: issued.expiresAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    logger.error('会员升级失败', err instanceof Error ? err : null, { message });
    return NextResponse.json(
      { error: `升级失败，请稍后重试: ${message}` },
      { status: 500 },
    );
  }
}