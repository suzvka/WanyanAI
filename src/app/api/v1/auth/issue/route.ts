/**
 * POST /api/v1/auth/issue
 *
 * 平台认证登录成功后，客户端提交 OAuth 授权码（+ PKCE verifier），
 * 本接口在服务端完成：
 *   1. 用平台签发的服务凭证向平台认证服务换 access token（授权码 + PKCE）
 *   2. 取用户信息（/api/oauth/userinfo）
 *   3. 向平台签发身份票据（/api/v1/identity/ticket，accountId 账户锚定）
 *   4. 以真实用户身份 + 身份票据向鉴权中心签发 station token 并返回给客户端
 *
 * 安全设计：
 * - 客户端仅提交 code + codeVerifier，不提交任何用户信息（杜绝自报用户）；
 * - 用户信息以平台认证服务 userinfo 返回为准；
 * - 服务凭证（client_id + client_secret）仅存于服务端，不下发浏览器。
 */
import { NextRequest, NextResponse } from 'next/server';
import { issueToken, getProductId } from '@/lib/auth-center/client';
import { exchangeAuthorizationCode, fetchUserInfo, requestIdentityTicket } from '@/lib/platform-auth/client';
import { PlatformAuthClientError } from '@/lib/platform-auth/types';
import { logInfo, logError } from '@/lib/api-station/logger';

// ============ 会员等级映射 ============

const MEMBERSHIP_TO_PERMISSION: Record<string, number> = {
  free: 1,
  vip: 2,
  svip: 3,
  admin: 99,
};

/** 平台认证返回的用户信息（仅取签发 token 所需字段） */
interface AuthenticatedUser {
  id: string;
  name?: string;
  email?: string;
}

/**
 * 根据用户信息确定会员等级。
 * 当前简单实现：所有登录用户默认 "free"。
 * 后续可扩展为从数据库/配置读取 VIP 关系。
 */
function determineMembershipLevel(_user: AuthenticatedUser): string {
  // TODO: 可扩展为从数据库查询用户的会员等级
  return 'free';
}

// ============ 路由处理 ============

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, codeVerifier, redirectUri } = body as {
      code?: string;
      codeVerifier?: string;
      redirectUri?: string;
    };

    // 参数校验
    if (!code || !codeVerifier || !redirectUri) {
      return NextResponse.json(
        { error: '缺少 code、codeVerifier 或 redirectUri', code: 'INVALID_REQUEST' },
        { status: 400 },
      );
    }

    // 1. 授权码换 access token（平台认证服务验证 PKCE + 授权码有效性）
    const tokenResult = await exchangeAuthorizationCode({ code, codeVerifier, redirectUri });
    logInfo('[Auth:Issue] 授权码交换成功', { scope: tokenResult.scope });

    // 2. 取真实用户信息
    const userInfo = await fetchUserInfo(tokenResult.access_token);

    const user: AuthenticatedUser = {
      id: userInfo.sub,
      name: userInfo.name,
      email: userInfo.email,
    };

    // 3. 签发身份票据（账户锚定凭据，token-contract v1.4 §3.6）：
    //    平台以 access token 校验用户后签发短时票据，accountId 以票据为准（产品不可自填）
    const identityTicket = await requestIdentityTicket(tokenResult.access_token);

    // 防御性校验：票据 accountId 必须与 userinfo sub 一致（平台签名背书的一致性）
    if (identityTicket.accountId !== userInfo.sub) {
      logError('[Auth:Issue] 身份票据与用户信息不一致', null, {
        ticketAccountId: identityTicket.accountId,
        sub: userInfo.sub,
      });
      return NextResponse.json(
        { error: '身份票据与用户信息不一致', code: 'IDENTITY_TICKET_MISMATCH' },
        { status: 500 },
      );
    }

    const membershipLevel = determineMembershipLevel(user);

    logInfo('[Auth:Issue] 开始签发 station token', {
      userId: identityTicket.accountId,
      membershipLevel,
    });

    // 4. 调用鉴权中心签发 station token（携带身份票据完成 accountId 锚定）
    const result = await issueToken({
      userId: identityTicket.accountId,
      productId: getProductId(),
      claims: {
        membershipLevel,
        name: user.name,
        email: user.email,
      },
      scope: ['api:chat', 'api:models'],
      ttl: 86400, // 24 小时
      identityTicket: identityTicket.ticket,
    });

    logInfo('[Auth:Issue] Token 签发成功', {
      userId: identityTicket.accountId,
      membershipLevel,
      expiresAt: result.expiresAt,
    });

    return NextResponse.json({
      token: result.token,
      expiresAt: result.expiresAt,
      membershipLevel,
      permissionLevel: MEMBERSHIP_TO_PERMISSION[membershipLevel] ?? 1,
      membership: {
        level: membershipLevel,
        permissionLevel: MEMBERSHIP_TO_PERMISSION[membershipLevel] ?? 1,
        expiresAt: result.expiresAt,
      },
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    logError('[Auth:Issue] Token 签发失败', error);

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: '请求体 JSON 格式错误', code: 'INVALID_JSON' },
        { status: 400 },
      );
    }

    // 平台认证/鉴权中心未配置（EnvConfigError 由 kit loadEnv 抛出）
    if (error instanceof Error && error.name === 'EnvConfigError') {
      return NextResponse.json(
        { error: '平台认证服务未配置，请联系管理员', code: 'AUTH_NOT_CONFIGURED' },
        { status: 503 },
      );
    }

    // 授权码交换/用户信息获取失败（含无效 code、PKCE 不匹配等）
    if (error instanceof PlatformAuthClientError) {
      return NextResponse.json(
        { error: error.message, code: 'OAUTH_EXCHANGE_FAILED' },
        { status: 401 },
      );
    }

    return NextResponse.json(
      { error: '签发凭证失败，请稍后重试', code: 'ISSUE_FAILED' },
      { status: 500 },
    );
  }
}
