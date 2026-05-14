/**
 * Token 提取工具（简化版）
 *
 * 从请求头提取访问密钥和客户端信息。
 */

/**
 * 从 Authorization: Bearer 中提取 key
 */
export function extractKey(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return null;
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/**
 * 提取客户端 IP
 */
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

// ============ 兼容旧接口（过渡期） ============

/**
 * @deprecated 使用 extractKey 替代
 */
export function extractUnifiedToken(request: Request): string | null {
  return extractKey(request);
}

/**
 * @deprecated 使用 extractKey 替代
 */
export function extractProxyKey(request: Request): string | null {
  return extractKey(request);
}

/**
 * @deprecated 使用 extractKey 替代
 */
export function extractAuthToken(request: Request): string | null {
  return extractKey(request);
}

/**
 * @deprecated 挑战机制已移除
 */
export function extractChallengeHeaders(_request: Request): {
  token: string | null;
  answer: string | null;
  nonce: number | null;
} {
  return {
    token: null,
    answer: null,
    nonce: null,
  };
}

/**
 * 解析统一 token
 * @deprecated 不再需要解析，key 直接使用
 */
export function parseUnifiedToken(unifiedToken: string): {
  proxyKey: string;
  accountToken: string | null;
} {
  // 兼容旧格式 <proxyKey>::<accountToken>
  const separatorIndex = unifiedToken.indexOf('::');

  if (separatorIndex === -1) {
    return { proxyKey: unifiedToken, accountToken: null };
  }

  const proxyKey = unifiedToken.slice(0, separatorIndex);
  const accountToken = unifiedToken.slice(separatorIndex + 2);

  return {
    proxyKey,
    accountToken: accountToken || null,
  };
}
