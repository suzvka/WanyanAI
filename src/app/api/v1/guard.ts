/**
 * /api/v1 统一请求守卫
 *
 * 所有 /api/v1/* 路由的入口层：在请求到达具体路由逻辑之前，
 * 统一执行 Bearer key 提取与格式验证。
 */

import { NextResponse } from 'next/server';
import { validateKey } from '@/lib/api-station/authPlugins';
import { createErrorResponse } from '@/lib/api-station/mockResponse';

// ========== 类型定义 ==========

export type KeyValidationResult =
  | { valid: true; key: string }
  | { valid: false; errorResponse: Response };

// ========== Key 提取 ==========

/**
 * 从请求头中提取 Bearer key
 * @returns 提取到的 key，无 Authorization 头或格式不对时返回 null
 */
export function extractBearerKey(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return null;
  }

  // Bearer <key>
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

// ========== 统一验证入口 ==========

/**
 * 对请求执行统一的 key 格式验证
 *
 * 验证通过 → 返回 { valid: true, key }
 * 验证失败 → 返回 { valid: false, errorResponse } （调用方直接 return 该 errorResponse）
 */
export function validateRequestKey(
  request: Request,
  requestId: string,
): KeyValidationResult {
  const key = extractBearerKey(request);

  if (!validateKey(key)) {
    return {
      valid: false,
      errorResponse: NextResponse.json(
        createErrorResponse(
          'Invalid API key format',
          'authentication_error',
          'INVALID_KEY_FORMAT',
          { requestId },
        ),
        { status: 401 },
      ),
    };
  }

  return { valid: true, key: key! };
}
