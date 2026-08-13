import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/v1/admin/verify
 *
 * 验证 Admin Token。
 * 通过后返回一个 session token（实际为简单签名，生产环境建议用 JWT）。
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

    const expectedToken = process.env.ADMIN_PASSWORD;

    // 未配置 ADMIN_PASSWORD 时，禁止访问
    if (!expectedToken) {
      return NextResponse.json(
        { error: 'Admin access not configured', code: 'ADMIN_NOT_CONFIGURED' },
        { status: 503 },
      );
    }

    if (token !== expectedToken) {
      return NextResponse.json(
        { error: 'Invalid token', code: 'INVALID_TOKEN' },
        { status: 401 },
      );
    }

    // 验证通过，返回一个简单的会话 token（实际生产环境建议用 JWT）
    // 这里使用 token 的简单签名作为会话标识
    const sessionToken = Buffer.from(`admin:${token}:${Date.now()}`).toString('base64');

    const response = NextResponse.json({ success: true, sessionToken });

    // 设置 httpOnly cookie，30 分钟过期
    response.cookies.set('admin_session', sessionToken, {
      httpOnly: true,
      secure: process.env.COZE_PROJECT_ENV === 'PROD',
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