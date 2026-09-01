/**
 * 鉴权中心（Token Authority Service）HTTP 客户端
 *
 * 使用服务端 API Key 认证，所有方法仅在服务端调用。
 * 环境变量：
 *   AUTH_CENTER_URL       - 鉴权服务 base URL
 *   AUTH_CENTER_API_KEY   - 客户端凭证 (sk-client-xxx)
 *   AUTH_CENTER_PRODUCT_ID - 产品标识
 */
import 'server-only';
import { loadEnv } from 'yunzone-service-kit/config';
import { authCenterEnvSchema, envLoadOptions } from '@/lib/env-schema';
import type {
  IssueTokenRequest,
  IssueTokenResponse,
  IntrospectTokenRequest,
  IntrospectTokenResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
  RevokeTokenRequest,
  RevokeTokenResponse,
  HealthCheckResponse,
  AuthCenterError,
} from './types';
import { createLogger } from '@/lib/api-station/logger';

const logger = createLogger('auth-center');

// ============ 配置读取 ============

function getConfig(): { baseUrl: string; apiKey: string; productId: string } {
  // 三要素缺失时 loadEnv 抛 EnvConfigError（诊断快照只显示 set/unset，不回显值）
  const env = loadEnv(authCenterEnvSchema, envLoadOptions);

  return {
    baseUrl: env.AUTH_CENTER_URL.replace(/\/$/, ''),
    apiKey: env.AUTH_CENTER_API_KEY,
    productId: env.AUTH_CENTER_PRODUCT_ID,
  };
}

// ============ 通用请求 ============

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const { baseUrl, apiKey } = getConfig();
  const url = `${baseUrl}${path}`;

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  const fetchOptions: RequestInit = {
    method: options.method ?? 'POST',
    headers,
  };

  if (options.body !== undefined) {
    fetchOptions.body = JSON.stringify(options.body);
  }

  const res = await fetch(url, fetchOptions);

  if (!res.ok) {
    const error: AuthCenterError = await res.json().catch(() => ({
      code: 'UNKNOWN',
      message: `HTTP ${res.status}`,
    }));
    logger.error('[AuthCenter] 请求失败', null, {
      path,
      status: res.status,
      code: error.code,
      message: error.message,
    });
    // 附加错误码（Error.cause 风格），供调用方按 code 做幂等/降级判断
    const httpError = new Error(`[AuthCenter] ${error.code}: ${error.message}`) as Error & {
      code?: string;
      status?: number;
    };
    httpError.code = error.code;
    httpError.status = res.status;
    throw httpError;
  }

  return res.json() as Promise<T>;
}

// ============ API 方法 ============

/** 健康检查 */
export async function healthCheck(): Promise<HealthCheckResponse> {
  const { baseUrl } = getConfig();
  const res = await fetch(`${baseUrl}/api/healthz`);
  return res.json();
}

/**
 * 颁发 Token
 * 为用户签发访问 Token，同一 (userId, productId) 重复签发会替换旧 Token。
 * claims 中可存放会员等级等自定义信息。
 */
export async function issueToken(params: IssueTokenRequest): Promise<IssueTokenResponse> {
  // API 边界映射（反腐层）：本域 userId → 鉴权中心 opaque 槽位字段 tag
  const { userId, productId, ...rest } = params;
  const data = await request<{
    token: string;
    expiresAt: string;
    tag: string;
    productId: string;
    scope: string[];
  }>('/api/v1/token/issue', {
    body: {
      ...rest,
      tag: userId,
      productId: productId || getConfig().productId,
    },
  });
  // 响应边界映射：tag → 本域 userId
  return {
    token: data.token,
    expiresAt: data.expiresAt,
    userId: data.tag,
    productId: data.productId,
    scope: data.scope,
  };
}

/**
 * 校验 Token
 * 验证 Token 有效性，获取关联的用户信息和 claims。
 * 无效 Token 统一返回 { active: false }（防枚举攻击）。
 */
export async function introspectToken(
  params: IntrospectTokenRequest,
): Promise<IntrospectTokenResponse> {
  // API 边界映射：鉴权中心返回 opaque 槽位 tag → 本域 userId
  const data = await request<{
    active: boolean;
    tag?: string;
    productId?: string;
    scope?: string[];
    claims?: Record<string, unknown>;
    expiresAt?: string;
  }>('/api/v1/token/introspect', {
    body: params,
  });
  if (!data.active) return { active: false };
  return {
    active: true,
    userId: data.tag ?? '',
    productId: data.productId ?? '',
    scope: data.scope ?? [],
    claims: data.claims ?? {},
    expiresAt: data.expiresAt ?? '',
  };
}

/**
 * 刷新 Token
 * 延长 Token 过期时间，Token 必须为 active 状态。
 */
export async function refreshToken(params: RefreshTokenRequest): Promise<RefreshTokenResponse> {
  return request<RefreshTokenResponse>('/api/v1/token/refresh', {
    body: params,
  });
}

/**
 * 吊销 Token
 * 支持按 Token 值吊销单个，或按 userId 批量吊销。
 */
export async function revokeToken(params: RevokeTokenRequest): Promise<RevokeTokenResponse> {
  // API 边界映射：本域 userId → 鉴权中心槽位字段 tag（按槽位批量吊销）
  const { userId, productId, ...rest } = params;
  return request<RevokeTokenResponse>('/api/v1/token/revoke', {
    body: {
      ...rest,
      tag: userId,
      productId: productId || getConfig().productId,
    },
  });
}

/** 获取当前产品 ID */
export function getProductId(): string {
  return getConfig().productId;
}