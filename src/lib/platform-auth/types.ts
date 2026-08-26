/**
 * 平台认证（云洲平台统一认证服务，OAuth 2.0）类型定义
 *
 * 基于平台认证服务（当前实现者为用户中心）的 OAuth 2.0 端点契约：
 *   POST /api/oauth/token        — 授权码换 access token
 *   GET  /api/oauth/userinfo     — 用户信息（OIDC UserInfo）
 *   POST /api/v1/identity/ticket — 身份票据（账户锚定凭据，token-contract v1.4 §3.6）
 *
 * 服务凭证（client_id + client_secret）由鉴权中心统一签发，
 * 平台认证服务仅透传验证，本模块为纯消费者侧封装。
 */

// ============ 请求/响应类型 ============

/** 授权码换 token 响应（POST /api/oauth/token） */
export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

/** 用户信息响应（GET /api/oauth/userinfo，OIDC UserInfo） */
export interface UserInfoResponse {
  sub: string;
  name?: string;
  preferred_username?: string;
  email?: string;
  email_verified?: boolean;
  updated_at?: number;
}

/**
 * 身份票据响应（POST /api/v1/identity/ticket，token-contract v1.4 §3.6）
 * accountId = 平台统一账户 id（= userinfo.sub 值空间）；票据短时有效（默认 300s）
 */
export interface IdentityTicketResponse {
  accountId: string;
  ticket: string;
  expiresIn: number;
}

/** 平台认证错误响应（OAuth 2.0 错误格式） */
export interface PlatformAuthError {
  error: string;
  error_description?: string;
}

/** 平台认证客户端异常（含 OAuth 错误码） */
export class PlatformAuthClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'PlatformAuthClientError';
  }
}
