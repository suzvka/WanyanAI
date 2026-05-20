/**
 * Key 提取工具
 *
 * 鉴权已于 2026-05 上移至主入口 route.ts 统一处理。
 * 此模块仅保留从请求头提取 key 的工具函数。
 */

export { isValidKeyFormat } from './keyFormat';

/**
 * 从请求头提取 key
 */
export function extractKey(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return null;
  }

  // Bearer <key>
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}
