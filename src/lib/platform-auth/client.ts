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

/** 平台认证请求超时（ms）：平台偶发挂起时避免 issue 请求被无限拖死 */
const PLATFORM_AUTH_TIMEOUT_MS = 15_000;

/** 授权码交换对上游 5xx 的最大尝试次数（1 次原始 + 1 次重试） */
const TOKEN_EXCHANGE_MAX_ATTEMPTS = 2;

/** 上游 5xx 重试退避（ms） */
const TOKEN_EXCHANGE_RETRY_DELAY_MS = 400;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 带超时的 fetch（平台端点统一入口，避免单点挂起） */
async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(PLATFORM_AUTH_TIMEOUT_MS) });
}

/**
 * 将 fetch 网络层异常（不可达 / 超时）包装为 PlatformAuthClientError 统一抛出。
 * upstreamStatus = 0 表示未获得上游响应，下游据此归类为「平台暂时不可用」（502）。
 */
function wrapNetworkError(error: unknown, path: string): never {
  const isTimeout =
    error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
  logger.error(
    '[PlatformAuth] 网络请求异常',
    error instanceof Error ? error : null,
    { path, kind: isTimeout ? 'timeout' : 'network' },
  );
  throw new PlatformAuthClientError(
    isTimeout ? 'PLATFORM_TIMEOUT' : 'PLATFORM_NETWORK_ERROR',
    isTimeout ? '平台认证服务响应超时' : '无法连接平台认证服务',
    0,
  );
}

/**
 * 解析 OAuth 错误响应：记录诊断日志（含响应体原文截断）并构造 PlatformAuthClientError。
 * 不直接 throw，便于授权码交换的重试循环使用。
 */
function buildOAuthError(res: Response, raw: string, path: string): PlatformAuthClientError {
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
    // 上游 5xx 时记录响应体原文（截断），辅助判断平台侧故障类型
    upstreamBody: res.status >= 500 ? raw.slice(0, 500) : undefined,
  });
  return new PlatformAuthClientError(code, description, res.status);
}

// ============ API 方法 ============

/**
 * 授权码换 access token
 * POST /api/oauth/token（grant_type=authorization_code）
 *
 * 容错策略：
 * - 仅对上游 5xx（server_error 等）重试一次（短退避）。授权码为一次性消费，
 *   若平台在首次请求中已实际签发 token 但响应丢失，重试将得到 4xx 并按原样失败，
 *   不会引入额外副作用；4xx（invalid_grant / invalid_client 等）不重试。
 * - 请求携带 15s 超时，网络异常统一包装为 upstreamStatus=0 的客户端错误。
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

  const requestInit: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  };

  // 失败诊断摘要（脱敏：不记录 code 全文 / verifier / secret）
  const exchangeContext = {
    codePrefix: params.code.slice(0, 8),
    codeLength: params.code.length,
    verifierLength: params.codeVerifier.length,
    redirectUri: params.redirectUri,
    clientIdPrefix: clientId.slice(0, 12),
  };

  let lastError: PlatformAuthClientError | null = null;
  for (let attempt = 1; attempt <= TOKEN_EXCHANGE_MAX_ATTEMPTS; attempt++) {
    const res = await fetchWithTimeout(`${baseUrl}/api/oauth/token`, requestInit).catch((error: unknown) =>
      wrapNetworkError(error, '/api/oauth/token'),
    );

    const raw = await res.text();
    if (res.ok) {
      return JSON.parse(raw) as TokenResponse;
    }

    lastError = buildOAuthError(res, raw, '/api/oauth/token');
    // 仅上游 5xx（平台内部故障）值得重试；授权码无效/凭证错误等 4xx 直接失败
    const retryable = res.status >= 500;
    if (!retryable || attempt === TOKEN_EXCHANGE_MAX_ATTEMPTS) {
      // 保留失败上下文，便于区分「code 过期/重复消费」与「平台真故障」
      logger.error('[PlatformAuth] 授权码交换最终失败', lastError, {
        attempt,
        ...exchangeContext,
      });
      throw lastError;
    }

    logger.warn('[PlatformAuth] 上游 5xx，准备重试授权码交换', {
      attempt,
      status: res.status,
      retryDelayMs: TOKEN_EXCHANGE_RETRY_DELAY_MS,
    });
    await delay(TOKEN_EXCHANGE_RETRY_DELAY_MS);
  }

  // 循环内必然 return/throw，此处仅为 TS 收窄兜底
  throw lastError ?? new PlatformAuthClientError('PLATFORM_AUTH_ERROR', '授权码交换失败', 500);
}

/**
 * 获取用户信息
 * GET /api/oauth/userinfo（Bearer access token）
 */
export async function fetchUserInfo(accessToken: string): Promise<UserInfoResponse> {
  const { baseUrl } = getConfig();

  const res = await fetchWithTimeout(`${baseUrl}/api/oauth/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  }).catch((error: unknown) => wrapNetworkError(error, '/api/oauth/userinfo'));

  const raw = await res.text();
  if (!res.ok) {
    throw buildOAuthError(res, raw, '/api/oauth/userinfo');
  }

  return JSON.parse(raw) as UserInfoResponse;
}
