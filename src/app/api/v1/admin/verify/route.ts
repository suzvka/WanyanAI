import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_SESSION_COOKIE,
  createSignedAdminSession,
  resolveAdminConfig,
  verifyAdminPasswordWithHash,
  hashAdminPassword,
} from 'yunzone-service-kit/ops';
import { loadEnv } from 'yunzone-service-kit/config';
import { envSchema, envLoadOptions } from '@/lib/env-schema';

/**
 * POST /api/v1/admin/verify
 *
 * 校验管理员密码并签发 HMAC 签名会话（v1.0 Admin Session Protocol）。
 * 管理语义统一（service-kit/ops）：ADMIN_PASSWORD 未设置 = 管理后台禁用（503）。
 */

/** 简易内存登录限流（防暴力枚举；生产建议接入平台 rate-limit.json） */
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

function isRateLimited(key: string): number | null {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || now >= entry.resetAt) {
    loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return null;
  }
  entry.count++;
  if (entry.count > LOGIN_MAX_ATTEMPTS) {
    return Math.ceil((entry.resetAt - now) / 1000);
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body as { token?: string };

    if (!token) {
      return NextResponse.json(
        { error: 'Missing token', code: 'MISSING_TOKEN' },
        { status: 400 },
      );
    }

    const admin = resolveAdminConfig();

    // 未配置 ADMIN_PASSWORD 时，禁止访问（协议 2.8：统一 ADMIN_DISABLED）
    if (!admin.enabled || !admin.password) {
      return NextResponse.json(
        { code: 'ADMIN_DISABLED', message: '管理后台已禁用' },
        { status: 503 },
      );
    }

    // 登录限流（防暴力枚举，协议 2.5）
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const retryAfter = isRateLimited(`adminVerify:${ip}`);
    if (retryAfter !== null) {
      return NextResponse.json(
        { error: 'Too many attempts', code: 'RATE_LIMITED', retryAfter },
        { status: 429 },
      );
    }

    // 常量时间比对（密码长度不等直接失败，防抛异常）
    if (
      !verifyAdminPasswordWithHash(
        token,
        hashAdminPassword(admin.password),
      )
    ) {
      return NextResponse.json(
        { code: 'UNAUTHENTICATED', message: '用户名或密码错误' },
        { status: 401 },
      );
    }

    // 验证通过，签发 HMAC 签名会话（协议 2.3）
    const sessionToken = createSignedAdminSession(admin.password);

    const response = NextResponse.json({ success: true, sessionToken });

    // 部署环境经中立键读取（TICKET-001：禁止裸读 COZE_PROJECT_ENV）
    const env = loadEnv(envSchema, envLoadOptions);

    // 会话有效期由 ADMIN_SESSION_MAX_AGE 驱动（默认 24h）
    response.cookies.set(ADMIN_SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: env.DEPLOY_ENV === 'PROD',
      sameSite: 'lax',
      maxAge: admin.sessionMaxAgeSeconds,
      path: '/',
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body', code: 'INVALID_REQUEST' },
      { status: 400 },
    );
  }
}