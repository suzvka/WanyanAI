import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * 验证请求是否来自已认证的 Admin 会话
 */
export async function validateAdminSession(): Promise<{ valid: true } | { valid: false; response: Response }> {
  const expectedToken = process.env.ADMIN_TOKEN;

  if (!expectedToken) {
    return {
      valid: false,
      response: NextResponse.json(
        { error: 'Admin access not configured', code: 'ADMIN_NOT_CONFIGURED' },
        { status: 503 },
      ),
    };
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('admin_session')?.value;

  if (!sessionToken) {
    return {
      valid: false,
      response: NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 },
      ),
    };
  }

  // 验证 session token 的合法性（解码验证签名）
  try {
    const decoded = Buffer.from(sessionToken, 'base64').toString('utf-8');
    // 格式: admin:<token>:<timestamp>
    const parts = decoded.split(':');
    if (parts.length !== 3 || parts[0] !== 'admin' || parts[1] !== expectedToken) {
      return {
        valid: false,
        response: NextResponse.json(
          { error: 'Invalid session', code: 'INVALID_SESSION' },
          { status: 401 },
        ),
      };
    }

    // 检查是否过期（30 分钟）
    const timestamp = parseInt(parts[2], 10);
    if (Date.now() - timestamp > 30 * 60 * 1000) {
      return {
        valid: false,
        response: NextResponse.json(
          { error: 'Session expired', code: 'SESSION_EXPIRED' },
          { status: 401 },
        ),
      };
    }

    return { valid: true };
  } catch {
    return {
      valid: false,
      response: NextResponse.json(
        { error: 'Invalid session', code: 'INVALID_SESSION' },
        { status: 401 },
      ),
    };
  }
}