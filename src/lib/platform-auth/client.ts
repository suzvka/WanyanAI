/**
 * 平台认证（云洲平台统一认证服务）HTTP 客户端
 *
 * 使用平台签发的服务凭证（client_id + client_secret）调用平台认证服务
 * 的 OAuth 2.0 端点。所有方法仅在服务端调用（凭证不得下发浏览器）。
 *
 * 环境变量（平台认证面，见 @/lib/env-schema）：
 *   PLATFORM_AUTH_URL     - 平台认证服务 base URL
 *   PLATFORM_CLIENT_ID    - 平台签发的服务凭证 client_id
 *   PLATFORM_CLIENT_SECRET - 平台签发的服务凭证 client_secret
 *
 * 凭证由鉴权中心（yunzone_auth）admin/credentials 统一签发，
 * 平台认证服务（用户中心）仅透传验证，本模块为纯消费者侧封装。
 */
import 'server-only';
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

function getConfig(): { baseUrl: string; clientId: string; clientSecret: string } {
  // 三要素缺失时 loadEnv 抛 EnvConfigError（诊断快照只显示 set/unset，不回显值）
  const env = loadEnv(platformAuthEnvSchema, envLoadOptions);

  return {
    baseUrl: env.PLATFORM_AUTH_URL.replace(/\/$/, ''),
    clientId: env.PLATFORM_CLIENT_ID,
    clientSecret: env.PLATFORM_CLIENT_SECRET,
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
