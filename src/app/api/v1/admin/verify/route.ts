import { NextRequest, NextResponse } from 'next/server';
import {
  createAdminSession,
  resolveAdminConfig,
  verifyAdminToken,
} from 'yunzone-service-kit/ops';
import { loadEnv } from 'yunzone-service-kit/config';
import { envSchema, envLoadOptions } from '@/lib/env-schema';

/**
 * POST /api/v1/admin/verify
 *
 * 验证 Admin Token。
 * 通过后返回一个 session token（实际为简单签名，生产环境建议用 JWT）。
 * 管理语义统一（service-kit/ops）：ADMIN_PASSWORD 未设置 = 管理后台禁用（503）。
 */
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

    // 未配置 ADMIN_PASSWORD 时，禁止访问
    if (!admin.enabled || !admin.password) {
      return NextResponse.json(
        { error: 'Admin access not configured', code: 'ADMIN_NOT_CONFIGURED' },
        { status: 503 },
      );
    }

    if (!verifyAdminToken(token, admin.password)) {
      return NextResponse.json(
        { error: 'Invalid token', code: 'INVALID_TOKEN' },
        { status: 401 },
      );
    }

    // 验证通过，返回一个简单的会话 token（实际生产环境建议用 JWT）
    const sessionToken = createAdminSession(admin.password);

    const response = NextResponse.json({ success: true, sessionToken });

    // 部署环境经中立键读取（TICKET-001：禁止裸读 COZE_PROJECT_ENV）
    const env = loadEnv(envSchema, envLoadOptions);

    // 设置 httpOnly cookie，30 分钟过期
    response.cookies.set('admin_session', sessionToken, {
      httpOnly: true,
      secure: env.DEPLOY_ENV === 'PROD',
      sameSite: 'lax',
      maxAge: 30 * 60, // 30 分钟
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
