import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  ADMIN_SESSION_COOKIE,
  resolveAdminConfig,
  validateSignedAdminSession,
} from 'yunzone-service-kit/ops';

/**
 * 验证请求是否来自已认证的 Admin 会话（v1.0 Admin Session Protocol）。
 * 会话语义统一（service-kit/ops）：ADMIN_PASSWORD 未设置 = 管理后台禁用（503）。
 * 错误码统一：禁用 503 ADMIN_DISABLED；未认证 401 UNAUTHENTICATED
 * （会话过期/非法再细分 SESSION_EXPIRED / INVALID_SESSION 供前端提示）。
 */
export async function validateAdminSession(): Promise<{ valid: true } | { valid: false; response: Response }> {
  const admin = resolveAdminConfig();

  if (!admin.enabled || !admin.password) {
    return {
      valid: false,
      response: NextResponse.json(
        { code: 'ADMIN_DISABLED', message: '管理后台已禁用' },
        { status: 503 },
      ),
    };
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (!sessionToken) {
    return {
      valid: false,
      response: NextResponse.json(
        { code: 'UNAUTHENTICATED', message: '未登录' },
        { status: 401 },
      ),
    };
  }

  const username = validateSignedAdminSession(sessionToken, admin.password, {
    maxAgeSeconds: admin.sessionMaxAgeSeconds,
  });
  if (username !== null) {
    return { valid: true };
  }

  // 区分过期与非法，保持既有错误码语义
  const expired = isExpiredSession(sessionToken, admin);
  return {
    valid: false,
    response: NextResponse.json(
      expired
        ? { code: 'SESSION_EXPIRED', message: '会话已过期' }
        : { code: 'INVALID_SESSION', message: '会话无效' },
      { status: 401 },
    ),
  };
}

/** 仅用于错误码区分：解析 HMAC 会话载荷并判断是否因过期而失效 */
function isExpiredSession(
  sessionToken: string,
  admin: { password: string | null; sessionMaxAgeSeconds: number }
): boolean {
  try {
    const parts = sessionToken.split('.');
    if (parts.length !== 2) return false;
    const payload = JSON.parse(
      Buffer.from(parts[0], 'base64url').toString('utf-8'),
    ) as { t?: unknown };
    return (
      typeof payload.t === 'number' &&
      admin.password !== null &&
      Math.floor(Date.now() / 1000) - payload.t > admin.sessionMaxAgeSeconds
    );
  } catch {
    return false;
  }
}