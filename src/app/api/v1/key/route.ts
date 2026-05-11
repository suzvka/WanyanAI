/**
 * @deprecated 此接口已废弃，请通过认证服务器签发 key
 *
 * POST /api/v1/key
 *
 * 旧版功能：签发 proxy key（业务服务器本地签发）
 * 新版行为：返回废弃提示，引导客户端使用认证服务器
 *
 * 认证服务器签发接口：POST /api/auth/issue
 */

import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      error: {
        message: 'This endpoint is deprecated. Please use the auth service to obtain a key.',
        type: 'deprecated_error',
        code: 'ENDPOINT_DEPRECATED',
        hint: 'POST to /api/auth/issue on the auth service with your identity credentials.',
      },
    },
    {
      status: 410, // Gone
      headers: {
        'Cache-Control': 'no-store',
        'Deprecation': 'true',
        'Link': '</api/auth/issue>; rel="successor-version"',
      },
    },
  );
}
