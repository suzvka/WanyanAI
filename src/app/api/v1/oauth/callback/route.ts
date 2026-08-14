/**
 * POST /api/v1/oauth/callback
 *
 * 云洲 OAuth 2.0 回调处理
 *
 * 流程：
 * 1. 接收前端提交的授权码 (code) 和 PKCE verifier (code_verifier)
 * 2. 向云洲令牌交换端点 POST /api/oauth/token 换取 access_token
 * 3. 用 access_token 调云洲 GET /api/oauth/userinfo 获取用户信息
 * 4. 调用我方鉴权中心签发 station token
 * 5. 返回 station token + 用户信息给前端
 */
import { NextRequest, NextResponse } from 'next/server';
import { issueToken, getProductId } from '@/lib/auth-center/client';
import { logInfo, logError } from '@/lib/api-station/logger';

// ============ OAuth 配置 ============

function getOAuthConfig() {
  const clientId = process.env.OAUTH_CLIENT_ID;
  const clientSecret = process.env.OAUTH_CLIENT_SECRET;
  const providerUrl = process.env.OAUTH_PROVIDER_URL;

  if (!clientId || !clientSecret || !providerUrl) {
    throw new Error('[OAuth] 未配置 OAUTH_CLIENT_ID / OAUTH_CLIENT_SECRET / OAUTH_PROVIDER_URL');
  }

  const baseUrl = providerUrl.replace(/\/$/, '');
  return {
    clientId,
    clientSecret,
    tokenUrl: `${baseUrl}/api/oauth/token`,
    userinfoUrl: `${baseUrl}/api/oauth/userinfo`,
  };
}

// ============ 会员等级映射 ============

const MEMBERSHIP_TO_PERMISSION: Record<string, number> = {
  free: 1,
  vip: 2,
  svip: 3,
  admin: 99,
};

function determineMembershipLevel(): string {
  return 'free';
}

// ============ 令牌交换 ============

async function exchangeCodeForToken(code: string, codeVerifier: string, redirectUri: string) {
  const { clientId, clientSecret, tokenUrl } = getOAuthConfig();

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    code_verifier: codeVerifier,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
  });

  logInfo('[OAuth:Callback] 开始交换授权码', {
    tokenUrl,
    clientId,
    redirectUri: redirectUri.replace(/[?#].*$/, ''),
  });

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });

  const body = await res.json();

  if (!res.ok) {
    logError('[OAuth:Callback] 令牌交换失败', null, {
      status: res.status,
      error: body.error,
      errorDescription: body.error_description,
    });
    throw new Error(`[OAuth] 令牌交换失败: ${body.error} - ${body.error_description || ''}`);
  }

  logInfo('[OAuth:Callback] 令牌交换成功', {
    expiresIn: body.expires_in,
    scope: body.scope,
  });

  return body as {
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token?: string;
    scope: string;
  };
}

// ============ 获取用户信息 ============

async function getUserInfo(accessToken: string) {
  const { userinfoUrl } = getOAuthConfig();

  logInfo('[OAuth:Callback] 开始获取用户信息', { userinfoUrl });

  const res = await fetch(userinfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    logError('[OAuth:Callback] 获取用户信息失败', null, {
      status: res.status,
      error: body.error,
    });
    throw new Error(`[OAuth] 获取用户信息失败: ${res.status}`);
  }

  const userinfo = await res.json();

  logInfo('[OAuth:Callback] 用户信息获取成功', {
    sub: userinfo.sub,
    name: userinfo.name,
    email: userinfo.email,
  });

  return userinfo as {
    sub: string;
    name: string;
    preferred_username?: string;
    email: string;
    email_verified: boolean;
  };
}

// ============ 路由处理 ============

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, code_verifier, redirect_uri } = body as {
      code?: string;
      code_verifier?: string;
      redirect_uri?: string;
    };

    // 参数校验
    if (!code || !code_verifier || !redirect_uri) {
      return NextResponse.json(
        { error: '缺少 code 或 code_verifier 或 redirect_uri', code: 'INVALID_REQUEST' },
        { status: 400 },
      );
    }

    // 1. 交换授权码 → access_token
    const tokenResponse = await exchangeCodeForToken(code, code_verifier, redirect_uri);

    // 2. 获取用户信息
    const userinfo = await getUserInfo(tokenResponse.access_token);

    // 3. 签发我方 station token
    const membershipLevel = determineMembershipLevel();
    const userId = userinfo.sub;

    logInfo('[OAuth:Callback] 开始签发 station token', { userId, membershipLevel });

    const result = await issueToken({
      userId,
      productId: getProductId(),
      claims: {
        membershipLevel,
        name: userinfo.name,
        email: userinfo.email,
      },
      scope: ['api:chat', 'api:models'],
      ttl: 86400,
    });

    logInfo('[OAuth:Callback] 登录流程完成', {
      userId,
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
        id: userinfo.sub,
        name: userinfo.name,
        email: userinfo.email,
      },
    });
  } catch (error) {
    logError('[OAuth:Callback] 处理失败', error);

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: '请求体 JSON 格式错误', code: 'INVALID_JSON' },
        { status: 400 },
      );
    }

    if (error instanceof Error && error.message.includes('未配置')) {
      return NextResponse.json(
        { error: 'OAuth 服务未配置，请联系管理员', code: 'OAUTH_NOT_CONFIGURED' },
        { status: 503 },
      );
    }

    if (error instanceof Error && error.message.includes('[OAuth]')) {
      return NextResponse.json(
        { error: 'OAuth 认证失败，请重新登录', code: 'OAUTH_FAILED' },
        { status: 502 },
      );
    }

    return NextResponse.json(
      { error: '登录失败，请稍后重试', code: 'LOGIN_FAILED' },
      { status: 500 },
    );
  }
}