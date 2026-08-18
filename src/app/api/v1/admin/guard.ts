import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { resolveAdminConfig, validateAdminSession as isValidAdminSession } from 'yunzone-service-kit/ops';

/**
 * 验证请求是否来自已认证的 Admin 会话
 * 会话语义统一（service-kit/ops）：ADMIN_PASSWORD 未设置 = 管理后台禁用（503）
 */
export async function validateAdminSession(): Promise<{ valid: true } | { valid: false; response: Response }> {
  const admin = resolveAdminConfig();

  if (!admin.enabled || !admin.password) {
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

  if (isValidAdminSession(sessionToken, admin.password)) {
    return { valid: true };
  }

  // 区分过期与非法，保持既有错误码语义
  const expired = isExpiredSession(sessionToken, admin.password);
  return {
    valid: false,
    response: NextResponse.json(
      expired
        ? { error: 'Session expired', code: 'SESSION_EXPIRED' }
        : { error: 'Invalid session', code: 'INVALID_SESSION' },
      { status: 401 },
    ),
  };
}

/** 仅用于错误码区分：解码会话并判断是否因过期而失效 */
function isExpiredSession(sessionToken: string, password: string): boolean {
  try {
    const decoded = Buffer.from(sessionToken, 'base64').toString('utf-8');
    const parts = decoded.split(':');
    const timestamp = parseInt(parts[2], 10);
    return (
      parts.length === 3 &&
      parts[0] === 'admin' &&
      parts[1] === password &&
      Number.isFinite(timestamp) &&
      Date.now() - timestamp > 30 * 60 * 1000
    );
  } catch {
    return false;
  }
}
