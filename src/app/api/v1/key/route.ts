import { extractClientIp } from '@/lib/api-station/authExtractor';
import { issueProxyKey, isValidUserRef } from '@/lib/api-station/proxyKey';
import { checkRateLimit } from '@/lib/api-station/rateLimit';
import { buildVisitorSessionCookieHeader, resolveVisitorSession } from '@/lib/api-station/visitorSession';
import { GUEST_PERMISSION_LEVEL } from '@/types/apiStationAuth';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

function isHttpsRequest(request: Request): boolean {
  const protocol = request.headers.get('x-forwarded-proto');
  if (protocol) {
    return protocol.toLowerCase() === 'https';
  }
  return false;
}

function buildCookieHeader(cookieValue: string, isHttps: boolean): string {
  const segments = [
    `wanyan_visitor=${encodeURIComponent(cookieValue)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${30 * 24 * 60 * 60}`, // 30 days
  ];

  if (isHttps) {
    segments.push('Secure');
    segments.push('SameSite=None');
  } else {
    segments.push('SameSite=Lax');
  }

  return segments.join('; ');
}

function createGuestUserRef(): string {
  return crypto.randomUUID();
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { userRef?: unknown } | null;
    const requestedUserRef = typeof body?.userRef === 'string' ? body.userRef.trim() : '';
    const userRef = requestedUserRef && isValidUserRef(requestedUserRef)
      ? requestedUserRef
      : createGuestUserRef();
    const visitorSession = await resolveVisitorSession(request);
    const clientIp = extractClientIp(request);
    const rateLimitResult = checkRateLimit({
      subjectId: clientIp ? `ip:${clientIp}` : `guest:${visitorSession.session.visitorId}`,
      permissionLevel: GUEST_PERMISSION_LEVEL,
    });

    if (!rateLimitResult.allowed) {
      const headers: Record<string, string> = {
        'Cache-Control': 'no-store',
      };

      if (rateLimitResult.retryAfter) {
        headers['Retry-After'] = rateLimitResult.retryAfter.toString();
      }

      return NextResponse.json(
        {
          error: {
            message: rateLimitResult.reason || 'Too many key issuance requests',
            type: 'rate_limit_error',
            code: rateLimitResult.errorCode,
          },
        },
        {
          status: 429,
          headers,
        },
      );
    }

    const issued = await issueProxyKey({
      userRef,
      subjectType: 'guest',
      subjectId: visitorSession.session.visitorId,
      sessionId: visitorSession.session.sessionId,
      sessionBinding: {
        visitorIdHash: visitorSession.visitorIdHash,
      },
    });

    const response = NextResponse.json(
      {
        key: issued.key,
        expiresAt: issued.payload.expiresAt,
        permissionLevel: GUEST_PERMISSION_LEVEL,
        userRef,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );

    // 设置 visitor session cookie
    if (visitorSession.shouldSetCookie) {
      const isHttps = isHttpsRequest(request);
      const cookieHeader = buildCookieHeader(visitorSession.cookieValue, isHttps);
      response.headers.set('Set-Cookie', cookieHeader);
    }

    return response;
  } catch {
    return NextResponse.json(
      {
        error: {
          message: 'Failed to issue proxy key',
          type: 'authentication_error',
          code: 'PROXY_KEY_ISSUE_FAILED',
        },
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  }
}
