/**
 * 平台认证（云洲平台统一认证服务）HTTP 客户端
 *
 * 使用鉴权中心唯一凭证（AUTH_CENTER_API_KEY）调用平台认证服务
 * 的 OAuth 2.0 端点。所有方法仅在服务端调用（凭证不得下发浏览器）。
 *
 * 环境变量：
 *   PLATFORM_AUTH_URL   - 平台认证服务 base URL（平台认证面）
 *   AUTH_CENTER_API_KEY - 鉴权中心签发的唯一凭证（apiKey 明文）
 *
 * 凭证语义（单一凭证体系）：
 *   client_secret = AUTH_CENTER_API_KEY（apiKey 明文）
 *   client_id     = SHA-256(apiKey) hex（服务端派生，即鉴权中心签发时的
 *                   token_hash，见 yunzone_auth src/lib/crypto.ts hashToken）
 * 平台认证服务（用户中心）仅透传鉴权中心验证，本模块为纯消费者侧封装。
 */
import 'server-only';
import { createHash } from 'node:crypto';
import { loadEnv } from 'yunzone-service-kit/config';
import { envLoadOptions, platformAuthEnvSchema } from '@/lib/env-schema';
import { createLogger } from '@/lib/api-station/logger';
import {
  PlatformAuthClientError,
  type IdentityTicketResponse,
  type PlatformAuthError,
  type TokenResponse,
  type UserInfoResponse,
} from './types';

const logger = createLogger('platform-auth');

// ============ 配置读取 ============

/**
 * 派生 OAuth client_id：与鉴权中心 hashToken 一致（SHA-256 完整 apiKey 的 hex）。
 * client_id 是凭证的公开别名（publicClaims.clientId = token_hash），非独立凭证。
 */
export function deriveClientId(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}

function getConfig(): { baseUrl: string; clientId: string; clientSecret: string } {
  // 必填项缺失时 loadEnv 抛 EnvConfigError（诊断快照只显示 set/unset，不回显值）
  const env = loadEnv(platformAuthEnvSchema, envLoadOptions);

  return {
    baseUrl: env.PLATFORM_AUTH_URL.replace(/\/$/, ''),
    clientId: deriveClientId(env.AUTH_CENTER_API_KEY),
    clientSecret: env.AUTH_CENTER_API_KEY,
  };
}

// ============ 通用请求 ============

/** 解析 OAuth 错误响应并抛出 PlatformAuthClientError */
function throwOAuthError(res: Response, raw: string, path: string): never {
  let body: Partial<PlatformAuthError> = {};
  try {
    body = JSON.parse(raw) as Partial<PlatformAuthError>;
  } catch {
    // 非 JSON 响应，使用默认错误码
  }

  const code = body.error ?? 'PLATFORM_AUTH_ERROR';
  const description = body.error_description ?? `HTTP ${res.status}`;
  logger.error('[PlatformAuth] 请求失败', null, {
    path,
    status: res.status,
    code,
    description,
  });
  throw new PlatformAuthClientError(code, description);
}

// ============ API 方法 ============

/**
 * 授权码换 access token
 * POST /api/oauth/token（grant_type=authorization_code）
 */
export async function exchangeAuthorizationCode(params: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<TokenResponse> {
  const { baseUrl, clientId, clientSecret } = getConfig();

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: params.code,
    code_verifier: params.codeVerifier,
    redirect_uri: params.redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(`${baseUrl}/api/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const raw = await res.text();
  if (!res.ok) {
    throwOAuthError(res, raw, '/api/oauth/token');
  }

  return JSON.parse(raw) as TokenResponse;
}

/**
 * 获取用户信息
 * GET /api/oauth/userinfo（Bearer access token）
 */
export async function fetchUserInfo(accessToken: string): Promise<UserInfoResponse> {
  const { baseUrl } = getConfig();

  const res = await fetch(`${baseUrl}/api/oauth/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const raw = await res.text();
  if (!res.ok) {
    throwOAuthError(res, raw, '/api/oauth/userinfo');
  }

  return JSON.parse(raw) as UserInfoResponse;
}

/**
 * 签发身份票据（账户锚定凭据）
 * POST /api/v1/identity/ticket（Bearer 用户 access token）
 *
 * token-contract v1.4 §3.6：票据由平台（用户中心）签发、短时有效（默认 300s），
 * 用于向鉴权中心签发业务用户 token——accountId 以票据为准，产品不可自填。
 * 错误信封为用户中心统一格式 { success, message }（与 OAuth 端点不同）。
 */
export async function requestIdentityTicket(accessToken: string): Promise<IdentityTicketResponse> {
  const { baseUrl } = getConfig();

  const res = await fetch(`${baseUrl}/api/v1/identity/ticket`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const raw = await res.text();
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = JSON.parse(raw) as { success?: boolean; message?: string };
      if (typeof body?.message === 'string' && body.message) message = body.message;
    } catch {
      // 非 JSON 响应，使用默认错误信息
    }
    logger.error('[PlatformAuth] 身份票据签发失败', null, { status: res.status, message });
    throw new PlatformAuthClientError('IDENTITY_TICKET_FAILED', message);
  }

  return JSON.parse(raw) as IdentityTicketResponse;
}
