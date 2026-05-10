const VISITOR_SESSION_COOKIE = 'wanyan_visitor';
const DEFAULT_VISITOR_SESSION_SECRET = 'wanyanai-visitor-session-secret-dev-only';
const VISITOR_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
const VISITOR_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface VisitorSession {
  visitorId: string;
  sessionId: string;
  issuedAt: number;
}

export interface ResolvedVisitorSession {
  session: VisitorSession;
  cookieValue: string;
  visitorIdHash: string;
  shouldSetCookie: boolean;
}

function getVisitorSessionSecret(): string {
  const runtimeProcess = globalThis as unknown as {
    process?: {
      env?: Record<string, string | undefined>;
    };
  };

  return runtimeProcess.process?.env?.VISITOR_SESSION_SECRET || DEFAULT_VISITOR_SESSION_SECRET;
}

function toBase64Url(input: Uint8Array): string {
  let binary = '';
  input.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(input: string): Uint8Array {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

async function signPayload(payloadBase64: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(getVisitorSessionSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadBase64));
  return toBase64Url(new Uint8Array(signature));
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(input));
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

function isValidVisitorId(value: string): boolean {
  return VISITOR_ID_PATTERN.test(value);
}

function parseCookieValue(cookieHeader: string | null, cookieName: string): string | null {
  if (!cookieHeader) {
    return null;
  }

  const segments = cookieHeader.split(';');
  for (const segment of segments) {
    const [rawName, ...rawValue] = segment.trim().split('=');
    if (rawName === cookieName) {
      return rawValue.join('=');
    }
  }

  return null;
}

async function encodeSessionCookie(session: VisitorSession): Promise<string> {
  const payloadBase64 = toBase64Url(encoder.encode(JSON.stringify(session)));
  const signature = await signPayload(payloadBase64);
  return `${payloadBase64}.${signature}`;
}

async function decodeSessionCookie(cookieValue: string): Promise<VisitorSession | null> {
  try {
    const parts = cookieValue.split('.');
    if (parts.length !== 2) {
      return null;
    }

    const [payloadBase64, signature] = parts;
    const expectedSignature = await signPayload(payloadBase64);
    if (signature !== expectedSignature) {
      return null;
    }

    const payload = JSON.parse(decoder.decode(fromBase64Url(payloadBase64))) as VisitorSession;
    if (!isValidVisitorId(payload.visitorId) || !isValidVisitorId(payload.sessionId)) {
      return null;
    }

    if (typeof payload.issuedAt !== 'number' || payload.issuedAt <= 0) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export async function hashVisitorId(visitorId: string): Promise<string> {
  return sha256Hex(visitorId);
}

export async function getVisitorSessionFromRequest(request: Request): Promise<VisitorSession | null> {
  const cookieValue = parseCookieValue(request.headers.get('cookie'), VISITOR_SESSION_COOKIE);
  if (!cookieValue) {
    return null;
  }

  return decodeSessionCookie(cookieValue);
}

export async function resolveVisitorSession(request: Request): Promise<ResolvedVisitorSession> {
  const existingSession = await getVisitorSessionFromRequest(request);
  if (existingSession) {
    return {
      session: existingSession,
      cookieValue: await encodeSessionCookie(existingSession),
      visitorIdHash: await hashVisitorId(existingSession.visitorId),
      shouldSetCookie: false,
    };
  }

  const session: VisitorSession = {
    visitorId: crypto.randomUUID(),
    sessionId: crypto.randomUUID(),
    issuedAt: Date.now(),
  };

  return {
    session,
    cookieValue: await encodeSessionCookie(session),
    visitorIdHash: await hashVisitorId(session.visitorId),
    shouldSetCookie: true,
  };
}

function shouldUseSecureCookie(): boolean {
  const runtimeProcess = globalThis as unknown as {
    process?: {
      env?: Record<string, string | undefined>;
    };
  };

  const nodeEnv = runtimeProcess.process?.env?.NODE_ENV;
  const projectEnv = runtimeProcess.process?.env?.COZE_PROJECT_ENV;

  // 生产环境或 HTTPS 环境需要使用 Secure
  // 即使在开发环境，如果前端通过 HTTPS 访问，也需要 Secure
  return nodeEnv === 'production' || projectEnv === 'PROD';
}

export function buildVisitorSessionCookieHeader(cookieValue: string): string {
  const segments = [
    `${VISITOR_SESSION_COOKIE}=${encodeURIComponent(cookieValue)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${VISITOR_SESSION_MAX_AGE_SECONDS}`,
  ];

  // 只在 HTTPS 环境下使用 Secure 和 SameSite=None
  if (shouldUseSecureCookie()) {
    segments.push('Secure');
    segments.push('SameSite=None');
  } else {
    segments.push('SameSite=Lax');
  }

  return segments.join('; ');
}
