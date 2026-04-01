/**
 * 从请求头提取认证信息
 * 支持两种方式：
 * 1. OpenAI 标准：Authorization: Bearer ${apiKey}
 * 2. 向后兼容：X-Browser-Id: ${browserId}
 */
export function extractAuthToken(request: Request): string | null {
  // 优先检查 Authorization: Bearer xxx（OpenAI 标准）
  const authHeader = request.headers.get('Authorization');
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match) {
      return match[1].trim();
    }
  }

  // 回退检查 X-Browser-Id（向后兼容）
  const browserId = request.headers.get('X-Browser-Id');
  if (browserId) {
    return browserId;
  }

  return null;
}
