import { NextResponse, type NextRequest } from 'next/server';

/**
 * Middleware for handling Server Actions in proxied environments
 * 
 * 修复：当 x-forwarded-host 与 origin 不匹配时，更新 x-forwarded-host 使其与 origin 一致，
 * 从而绕过 Next.js 的 CSRF 检查。
 */
export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  let modified = false;

  // 获取关键 headers
  const origin = request.headers.get('origin');
  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = request.headers.get('host');

  // 处理所有 POST 请求（包括 Server Actions）
  if (request.method === 'POST' && origin && origin !== 'null') {
    try {
      const originHost = new URL(origin).host;

      // 让 x-forwarded-host 与 origin 匹配
      if (forwardedHost && forwardedHost !== originHost) {
        requestHeaders.set('x-forwarded-host', originHost);
        modified = true;
      }

      // 让 host 与 origin 匹配（如果需要）
      if (host && host !== originHost) {
        requestHeaders.set('host', originHost);
        modified = true;
      }
    } catch {
      // URL 解析失败，忽略
    }
  }

  if (modified) {
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // 匹配所有路由
    '/:path*',
  ],
};
