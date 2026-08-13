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
  const baseUrl = process.env.AUTH_CENTER_URL;
  const apiKey = process.env.AUTH_CENTER_API_KEY;
  const productId = process.env.AUTH_CENTER_PRODUCT_ID;

  if (!baseUrl) {
    throw new Error('[AuthCenter] 未配置 AUTH_CENTER_URL');
  }
  if (!apiKey) {
    throw new Error('[AuthCenter] 未配置 AUTH_CENTER_API_KEY');
  }
  if (!productId) {
    throw new Error('[AuthCenter] 未配置 AUTH_CENTER_PRODUCT_ID');
  }

  return { baseUrl: baseUrl.replace(/\/$/, ''), apiKey, productId };
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
    throw new Error(`[AuthCenter] ${error.code}: ${error.message}`);
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
  return request<IssueTokenResponse>('/api/v1/token/issue', {
    body: {
      ...params,
      productId: params.productId || getConfig().productId,
    },
  });
}

/**
 * 校验 Token
 * 验证 Token 有效性，获取关联的用户信息和 claims。
 * 无效 Token 统一返回 { active: false }（防枚举攻击）。
 */
export async function introspectToken(
  params: IntrospectTokenRequest,
): Promise<IntrospectTokenResponse> {
  return request<IntrospectTokenResponse>('/api/v1/token/introspect', {
    body: params,
  });
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
  return request<RevokeTokenResponse>('/api/v1/token/revoke', {
    body: {
      ...params,
      productId: params.productId || getConfig().productId,
    },
  });
}

/** 获取当前产品 ID */
export function getProductId(): string {
  return getConfig().productId;
}