import type {
  PermissionRole,
  ProxyKeyPayload,
  ProxyKeyPayloadV1,
  ProxyKeyPayloadV2,
  ProxyKeySessionBinding,
  ProxyKeyVerificationResult,
  SubjectType,
} from '@/types/apiStationAuth';

const DEFAULT_PROXY_KEY_SECRET = 'wanyanai-proxy-key-secret-dev-only';
const DEFAULT_PROXY_KEY_TTL_MS = 30 * 60 * 1000;
const USER_REF_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface IssueProxyKeyOptions {
  userRef?: string | null;
  subjectType?: SubjectType;
  subjectId?: string;
  sessionId?: string | null;
  sessionBinding?: ProxyKeySessionBinding | null;
  permissionHint?: PermissionRole;
  ttlMs?: number;
}

function getProxyKeySecret(): string {
  const runtimeProcess = globalThis as unknown as {
    process?: {
      env?: Record<string, string | undefined>;
    };
  };

  return runtimeProcess.process?.env?.PROXY_KEY_SECRET || DEFAULT_PROXY_KEY_SECRET;
}

export function isValidUserRef(userRef: string): boolean {
  return USER_REF_PATTERN.test(userRef);
}

function isValidSubjectHint(value: string): boolean {
  return USER_REF_PATTERN.test(value);
}

export function looksLikeProxyKey(key: string): boolean {
  const parts = key.split('.');
  return parts.length === 3 && isValidSubjectHint(parts[2] || '');
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
    encoder.encode(getProxyKeySecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadBase64));
  return toBase64Url(new Uint8Array(signature));
}

export async function issueProxyKey({
  userRef,
  subjectType,
  subjectId,
  sessionId = userRef ?? null,
  sessionBinding,
  permissionHint = 'guest',
  ttlMs = DEFAULT_PROXY_KEY_TTL_MS,
}: IssueProxyKeyOptions) {
  const now = Date.now();
  let payload: ProxyKeyPayload;
  let subjectHint: string;

  if (subjectType && subjectId && sessionId && sessionBinding) {
    if (!isValidSubjectHint(subjectId)) {
      throw new Error('Invalid subjectId format');
    }

    payload = {
      version: 'v2',
      subjectType,
      subjectId,
      userRef: userRef && isValidUserRef(userRef) ? userRef : null,
      sessionId,
      sessionBinding,
      issuedAt: now,
      expiresAt: now + ttlMs,
      permissionHint,
      keyUse: 'model_proxy',
    } satisfies ProxyKeyPayloadV2;
    subjectHint = subjectId;
  } else {
    if (!userRef || !isValidUserRef(userRef)) {
      throw new Error('Invalid userRef format');
    }

    payload = {
      version: 'v1',
      userRef,
      sessionId,
      issuedAt: now,
      expiresAt: now + ttlMs,
      permissionHint,
    } satisfies ProxyKeyPayloadV1;
    subjectHint = userRef;
  }

  const payloadBase64 = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await signPayload(payloadBase64);
  const proof = `${payloadBase64}.${signature}`;

  return {
    key: `${proof}.${subjectHint}`,
    proof,
    payload,
  };
}

export function extractProofFromProxyKey(key: string): string | null {
  const parts = key.split('.');
  if (parts.length !== 3) {
    return null;
  }

  return `${parts[0]}.${parts[1]}`;
}

export async function verifyProxyKey(key: string): Promise<ProxyKeyVerificationResult> {
  try {
    const parts = key.split('.');
    if (parts.length !== 3) {
      return {
        success: false,
        error: 'Invalid proxy key format',
        errorCode: 'INVALID_PROXY_KEY_FORMAT',
      };
    }

    const [payloadBase64, signature, subjectHint] = parts;
    if (!isValidSubjectHint(subjectHint)) {
      return {
        success: false,
        error: 'Invalid proxy key subject format',
        errorCode: 'INVALID_PROXY_KEY_SUBJECT_FORMAT',
      };
    }

    const expectedSignature = await signPayload(payloadBase64);
    if (signature !== expectedSignature) {
      return {
        success: false,
        error: 'Invalid proxy key signature',
        errorCode: 'INVALID_PROXY_KEY_SIGNATURE',
      };
    }

    const payload = JSON.parse(decoder.decode(fromBase64Url(payloadBase64))) as ProxyKeyPayload;
    if (payload.version !== 'v1' && payload.version !== 'v2') {
      return {
        success: false,
        error: 'Unsupported proxy key version',
        errorCode: 'UNSUPPORTED_PROXY_KEY_VERSION',
      };
    }

    if (Date.now() > payload.expiresAt) {
      return {
        success: false,
        error: 'Proxy key expired',
        errorCode: 'PROXY_KEY_EXPIRED',
      };
    }

    if (payload.version === 'v1') {
      if (payload.userRef !== subjectHint) {
        return {
          success: false,
          error: 'Proxy key user reference mismatch',
          errorCode: 'PROXY_KEY_USER_REF_MISMATCH',
        };
      }

      return {
        success: true,
        subjectType: 'guest',
        subjectId: payload.userRef,
        userRef: payload.userRef,
        sessionId: payload.sessionId,
        proof: `${payloadBase64}.${signature}`,
        payload,
      };
    }

    if (payload.subjectId !== subjectHint) {
      return {
        success: false,
        error: 'Proxy key subject mismatch',
        errorCode: 'PROXY_KEY_SUBJECT_MISMATCH',
      };
    }

    if (!payload.sessionId || !payload.sessionBinding?.visitorIdHash || payload.keyUse !== 'model_proxy') {
      return {
        success: false,
        error: 'Invalid proxy key session binding',
        errorCode: 'INVALID_PROXY_KEY_SESSION_BINDING',
      };
    }

    return {
      success: true,
      subjectType: payload.subjectType,
      subjectId: payload.subjectId,
      userRef: payload.userRef ?? undefined,
      sessionId: payload.sessionId,
      proof: `${payloadBase64}.${signature}`,
      payload,
    };
  } catch {
    return {
      success: false,
      error: 'Failed to parse proxy key',
      errorCode: 'PROXY_KEY_PARSE_ERROR',
    };
  }
}
