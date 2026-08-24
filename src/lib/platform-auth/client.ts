/**
 * 平台认证（云洲平台统一认证服务）HTTP 客户端
 *
 * 调用平台认证服务（用户中心）的 OAuth 2.0 端点。所有方法仅在服务端调用
 * （凭证不得下发浏览器）。
 *
 * 环境变量：
 *   PLATFORM_AUTH_URL       - 平台认证服务 base URL（平台认证面）
 *   AUTH_CENTER_API_KEY     - 鉴权中心签发的唯一凭证（apiKey 明文）
 *   PLATFORM_CLIENT_ID      - （可选）平台认证服务自有 OAuth client_id，设置后优先使用
 *   PLATFORM_CLIENT_SECRET  - （可选）平台认证服务自有 OAuth client_secret，设置后优先使用
 *
 * 凭证语义（二选一）：
 *   A. 单一凭证体系（默认）：client_secret = AUTH_CENTER_API_KEY（apiKey 明文）；
 *      client_id = SHA-256(apiKey) hex（服务端派生，即鉴权中心签发时的
 *      token_hash，见 yunzone_auth src/lib/crypto.ts hashToken）。
 *      适用前提：平台认证服务按同一规则透传验证 client。
 *   B. 平台自有注册凭证（PLATFORM_CLIENT_ID/SECRET 已设置时优先）：
 *      使用平台认证服务侧真实注册的 OAuth 客户端凭证，兼容标准 OAuth 注册表
 *      实现（平台不认识派生 client_id 时返回 Invalid client_id，需走此路径）。
 */
import 'server-only';
import { createHash } from 'node:crypto';
import { loadEnv } from 'yunzone-service-kit/config';
import { envLoadOptions, platformAuthEnvSchema } from '@/lib/env-schema';
import { createLogger } from '@/lib/api-station/logger';
import {
  PlatformAuthClientError,
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

/**
 * 解析平台认证服务 OAuth 客户端凭证。
 * 优先使用平台自有注册凭证（PLATFORM_CLIENT_ID / PLATFORM_CLIENT_SECRET），
 * 未配置时回退到单一凭证体系（client_id = SHA-256(apiKey)，secret = apiKey）。
 */
export function resolvePlatformCredentials(env: {
  PLATFORM_CLIENT_ID?: string;
  PLATFORM_CLIENT_SECRET?: string;
  AUTH_CENTER_API_KEY?: string;
}): { clientId: string; clientSecret: string; source: 'registered' | 'derived' } {
  if (env.PLATFORM_CLIENT_ID && env.PLATFORM_CLIENT_SECRET) {
    return {
      clientId: env.PLATFORM_CLIENT_ID,
      clientSecret: env.PLATFORM_CLIENT_SECRET,
      source: 'registered',
    };
  }
  if (env.AUTH_CENTER_API_KEY) {
    return {
      clientId: deriveClientId(env.AUTH_CENTER_API_KEY),
      clientSecret: env.AUTH_CENTER_API_KEY,
      source: 'derived',
    };
  }
  throw new Error(
    '平台认证凭证缺失：请配置 AUTH_CENTER_API_KEY（单一凭证派生），或 PLATFORM_CLIENT_ID + PLATFORM_CLIENT_SECRET（平台注册凭证）',
  );
}

function getConfig(): { baseUrl: string; clientId: string; clientSecret: string } {
  // 必填项缺失时 loadEnv 抛 EnvConfigError（诊断快照只显示 set/unset，不回显值）
  const env = loadEnv(platformAuthEnvSchema, envLoadOptions);
  const credentials = resolvePlatformCredentials(env);

  if (credentials.source === 'registered') {
    logger.info('[PlatformAuth] 使用平台注册 OAuth 客户端凭证');
  }

  return {
    baseUrl: env.PLATFORM_AUTH_URL.replace(/\/$/, ''),
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
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
