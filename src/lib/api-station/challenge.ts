import { getChallengeConfig } from './forwardConfig';
import { logInfo, logError } from './logger';

// Challenge 配置接口
interface ChallengeConfig {
  enabled: boolean;
  difficulty: number;
  tokenExpireMinutes: number;
  maxNonceAgeSeconds: number;
}

const DEFAULT_CHALLENGE_SECRET = 'wanyanai-challenge-secret-dev-only';
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface ChallengeTokenPayload {
  proofHash: string;
  userRef: string;
  issuedAt: number;
  expiresAt: number;
}

export interface ChallengeRequest {
  token: string | null;
  answer: string | null;
  nonce: number | null;
  proof: string | null;
  userRef: string;
}

export interface ChallengeResult {
  success: boolean;
  skipped?: boolean;
  error?: string;
  errorCode?: string;
  payload?: ChallengeTokenPayload;
}

export interface TokenIssueResult {
  token: string;
  payload: ChallengeTokenPayload;
}

const nonceCache = new Map<string, number>();

if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, expiresAt] of nonceCache.entries()) {
      if (now > expiresAt) {
        nonceCache.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

function getSigningSecret(): string {
  const runtimeProcess = globalThis as unknown as {
    process?: {
      env?: Record<string, string | undefined>;
    };
  };

  return runtimeProcess.process?.env?.CHALLENGE_SECRET || DEFAULT_CHALLENGE_SECRET;
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

async function hmacSign(input: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(getSigningSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(input));
  return toBase64Url(new Uint8Array(signature));
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(input));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function issueChallengeToken(
  proof: string,
  userRef: string,
  config?: ChallengeConfig,
): Promise<TokenIssueResult> {
  const finalConfig = config || await getChallengeConfig();
  const now = Date.now();
  const expiresAt = now + finalConfig.tokenExpireMinutes * 60 * 1000;

  const payload: ChallengeTokenPayload = {
    proofHash: await sha256Hex(proof),
    userRef,
    issuedAt: now,
    expiresAt,
  };

  const payloadBase64 = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await hmacSign(payloadBase64);
  const token = `${payloadBase64}.${signature}`;

  logInfo('[Challenge] 防刷挑战 Token 签发成功', {
    userRefPreview: `${userRef.slice(0, 8)}...`,
    expiresAt: new Date(expiresAt).toISOString(),
  });

  return { token, payload };
}

export async function verifyChallengeToken(token: string): Promise<ChallengeResult> {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) {
      return {
        success: false,
        error: 'Invalid token format',
        errorCode: 'INVALID_TOKEN_FORMAT',
      };
    }

    const [payloadBase64, signature] = parts;
    const expectedSignature = await hmacSign(payloadBase64);

    if (signature !== expectedSignature) {
      logError('[Challenge] Token 签名验证失败', null, { tokenPrefix: token.substring(0, 20) });
      return {
        success: false,
        error: 'Invalid token signature',
        errorCode: 'INVALID_TOKEN_SIGNATURE',
      };
    }

    const payload = JSON.parse(decoder.decode(fromBase64Url(payloadBase64))) as ChallengeTokenPayload;

    if (Date.now() > payload.expiresAt) {
      return {
        success: false,
        error: 'Token expired',
        errorCode: 'TOKEN_EXPIRED',
      };
    }
    
    return {
      success: true,
      payload,
    };
  } catch (error) {
    logError('[Challenge] Token 解析失败', error);
    return {
      success: false,
      error: 'Failed to parse token',
      errorCode: 'TOKEN_PARSE_ERROR',
    };
  }
}

async function computeChallengeAnswer(token: string, nonce: number): Promise<string> {
  const payloadBase64 = token.split('.')[0];
  const input = `${payloadBase64}:${nonce}`;
  return sha256Hex(input);
}

export async function verifyChallengeIfPresent(
  request: ChallengeRequest,
  config?: ChallengeConfig,
): Promise<ChallengeResult> {
  const finalConfig = config || await getChallengeConfig();
  const { token, answer, nonce, proof, userRef } = request;

  if (!finalConfig.enabled) {
    return {
      success: true,
      skipped: true,
    };
  }

  const hasChallengeSignal = Boolean(token || answer || nonce !== null);
  if (!hasChallengeSignal) {
    return {
      success: true,
      skipped: true,
    };
  }

  if (!token || !answer || nonce === null || !proof) {
    return {
      success: false,
      error: 'Incomplete challenge proof',
      errorCode: 'INCOMPLETE_CHALLENGE_PROOF',
    };
  }

  const tokenResult = await verifyChallengeToken(token);
  if (!tokenResult.success) {
    return tokenResult;
  }

  const payload = tokenResult.payload!;

  if (payload.userRef !== userRef) {
    return {
      success: false,
      error: 'Challenge user reference mismatch',
      errorCode: 'CHALLENGE_USER_REF_MISMATCH',
    };
  }

  const expectedProofHash = await sha256Hex(proof);
  if (payload.proofHash !== expectedProofHash) {
    return {
      success: false,
      error: 'Challenge proof mismatch',
      errorCode: 'CHALLENGE_PROOF_MISMATCH',
    };
  }

  if (nonce < 0 || nonce > 10_000_000) {
    return {
      success: false,
      error: 'Nonce out of valid range',
      errorCode: 'INVALID_NONCE_RANGE',
    };
  }

  const nonceKey = `${payload.userRef}:${payload.proofHash}:${nonce}`;
  const nonceExpiresAt = Date.now() + finalConfig.maxNonceAgeSeconds * 1000;

  if (nonceCache.has(nonceKey)) {
    logError('[Challenge] Nonce 已被使用', null, { userRefPreview: `${payload.userRef.slice(0, 8)}...`, nonce });
    return {
      success: false,
      error: 'Nonce already used',
      errorCode: 'NONCE_REUSED',
    };
  }

  const expectedAnswer = await computeChallengeAnswer(token, nonce);

  if (answer !== expectedAnswer) {
    logError('[Challenge] 挑战答案不正确', null, {
      userRefPreview: `${payload.userRef.slice(0, 8)}...`,
      expected: expectedAnswer.substring(0, 10) + '...',
      received: answer.substring(0, 10) + '...',
    });
    return {
      success: false,
      error: 'Invalid challenge answer',
      errorCode: 'INVALID_CHALLENGE_ANSWER',
    };
  }

  if (!answer.startsWith('0'.repeat(finalConfig.difficulty))) {
    return {
      success: false,
      error: `Challenge answer does not meet difficulty requirement (${finalConfig.difficulty})`,
      errorCode: 'INSUFFICIENT_DIFFICULTY',
    };
  }

  nonceCache.set(nonceKey, nonceExpiresAt);

  logInfo('[Challenge] 辅助防刷挑战验证成功', {
    userRefPreview: `${payload.userRef.slice(0, 8)}...`,
    nonce,
    difficulty: finalConfig.difficulty,
  });

  return {
    success: true,
    payload,
  };
}

export function cleanupExpiredNonces(): number {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [key, expiresAt] of nonceCache.entries()) {
    if (now > expiresAt) {
      nonceCache.delete(key);
      cleaned++;
    }
  }
  
  logInfo('[Challenge] Nonce 清理完成', { cleaned, remaining: nonceCache.size });
  return cleaned;
}
