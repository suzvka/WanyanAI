import type { ChallengeAuthParams } from './auth';

/**
 * 统一 token 分隔符
 * 格式: <proxyKey>::<accountToken>
 */
const TOKEN_SEPARATOR = '::';

/**
 * 从 Authorization: Bearer 中提取统一 token
 */
export function extractUnifiedToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return null;
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/**
 * 从 Authorization: Bearer 中提取 proxy key（向后兼容）
 * @deprecated 使用 extractUnifiedToken + parseUnifiedToken 替代
 */
export function extractProxyKey(request: Request): string | null {
  const unifiedToken = extractUnifiedToken(request);
  if (!unifiedToken) {
    return null;
  }
  const { proxyKey } = parseUnifiedToken(unifiedToken);
  return proxyKey;
}

/**
 * 解析统一 token
 * 
 * @param unifiedToken - 统一 token 字符串
 * @returns 解析结果，包含 proxyKey 和 accountToken
 */
export function parseUnifiedToken(unifiedToken: string): {
  proxyKey: string;
  accountToken: string | null;
} {
  const separatorIndex = unifiedToken.indexOf(TOKEN_SEPARATOR);

  if (separatorIndex === -1) {
    // 无分隔符 → 只有 proxyKey（兼容旧格式）
    return { proxyKey: unifiedToken, accountToken: null };
  }

  const proxyKey = unifiedToken.slice(0, separatorIndex);
  const accountToken = unifiedToken.slice(separatorIndex + TOKEN_SEPARATOR.length);

  return {
    proxyKey,
    accountToken: accountToken || null,
  };
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
