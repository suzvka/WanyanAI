import type { ChallengeAuthParams } from './auth';

/**
 * 从 Authorization: Bearer 中提取 proxy key
 */
export function extractProxyKey(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return null;
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/**
 * 向后兼容旧命名
 */
export function extractAuthToken(request: Request): string | null {
  return extractProxyKey(request);
}

export function extractClientIp(request: Request): string | null {
  const forwardedFor = request.headers.get('X-Forwarded-For');
  if (forwardedFor) {
    const ip = forwardedFor.split(',')[0]?.trim();
    if (ip) {
      return ip;
    }
  }

  const realIp = request.headers.get('X-Real-IP')?.trim();
  if (realIp) {
    return realIp;
  }

  const cfIp = request.headers.get('CF-Connecting-IP')?.trim();
  return cfIp || null;
}

/**
 * 从请求头提取挑战认证参数。
 *
 * 注意：当前主鉴权链路只依赖 Bearer proxy key；挑战参数仅作为可选辅助防刷信号使用。
 */
export function extractChallengeHeaders(request: Request): ChallengeAuthParams {
  const token = request.headers.get('X-Challenge-Token');
  const answer = request.headers.get('X-Challenge-Answer');
  const nonceStr = request.headers.get('X-Challenge-Nonce');

  return {
    token: token ? token.trim() : null,
    answer: answer || null,
    nonce: nonceStr !== null ? parseInt(nonceStr, 10) : null,
  };
}
