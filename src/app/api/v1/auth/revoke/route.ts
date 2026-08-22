/**
 * POST /api/v1/auth/revoke
 *
 * 吊销 station token（登出联动）。
 * 委托鉴权中心 revokeToken 物理删除，无效 Token 吊销不报错（幂等）。
 */
import { NextRequest, NextResponse } from 'next/server';
import { revokeToken, getProductId } from '@/lib/auth-center/client';
import { logError } from '@/lib/api-station/logger';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { token } = body as { token?: string };

  if (!token) {
    return NextResponse.json(
      { error: '缺少 token', code: 'INVALID_REQUEST' },
      { status: 400 },
    );
  }

  try {
    await revokeToken({ token, productId: getProductId() });
    return NextResponse.json({ success: true });
  } catch (error) {
    logError('[Auth:Revoke] Token 吊销失败', error);
    // 不阻塞客户端本地清理，返回 502 由调用方降级
    return NextResponse.json(
      { error: '凭证吊销失败', code: 'REVOKE_FAILED' },
      { status: 502 },
    );
  }
}
