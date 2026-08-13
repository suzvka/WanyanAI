/**
 * POST /api/v1/auth/issue
 *
 * 用户中心登录成功后，客户端提交 accountToken + user 信息，
 * 本接口向鉴权中心签发 station token 并返回给客户端。
 *
 * 流程：
 * 1. 接收 accountToken 和 user 信息
 * 2. 根据 user 信息确定会员等级
 * 3. 调用鉴权中心 issueToken，将会员等级写入 claims
 * 4. 返回 station token 给客户端
 */
import { NextRequest, NextResponse } from 'next/server';
import { issueToken, getProductId } from '@/lib/auth-center/client';
import { logInfo, logError } from '@/lib/api-station/logger';

// ============ 会员等级映射 ============

/**
 * 根据用户信息确定会员等级。
 * 当前简单实现：所有登录用户默认 "free"。
 * 后续可扩展为从数据库/配置读取 VIP 关系。
 */
function determineMembershipLevel(_user: { id: string; name: string; email: string; role: string }): string {
  // TODO: 可扩展为从数据库查询用户的会员等级
  return 'free';
}

// ============ 路由处理 ============

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accountToken, user } = body as {
      accountToken?: string;
      user?: { id: string; name: string; email: string; role: string };
    };

    // 参数校验
    if (!accountToken || !user?.id) {
      return NextResponse.json(
        { error: '缺少 accountToken 或 user 信息', code: 'INVALID_REQUEST' },
        { status: 400 },
      );
    }

    const membershipLevel = determineMembershipLevel(user);

    logInfo('[Auth:Issue] 开始签发 station token', {
      userId: user.id,
      membershipLevel,
    });

    // 调用鉴权中心签发 token
    const result = await issueToken({
      userId: user.id,
      productId: getProductId(),
      claims: {
        membershipLevel,
        name: user.name,
        email: user.email,
      },
      scope: ['api:chat', 'api:models'],
      ttl: 86400, // 24 小时
    });

    logInfo('[Auth:Issue] Token 签发成功', {
      userId: user.id,
      membershipLevel,
      expiresAt: result.expiresAt,
    });

    return NextResponse.json({
      token: result.token,
      expiresAt: result.expiresAt,
      membershipLevel,
    });
  } catch (error) {
    logError('[Auth:Issue] Token 签发失败', error);

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: '请求体 JSON 格式错误', code: 'INVALID_JSON' },
        { status: 400 },
      );
    }

    // 鉴权中心未配置
    if (error instanceof Error && error.message.includes('未配置 AUTH_CENTER')) {
      return NextResponse.json(
        { error: '鉴权服务未配置，请联系管理员', code: 'AUTH_NOT_CONFIGURED' },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: '签发凭证失败，请稍后重试', code: 'ISSUE_FAILED' },
      { status: 500 },
    );
  }
}