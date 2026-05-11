/**
 * POST /api/v1/key
 *
 * 代理接口：转发请求到认证服务器签发 key
 *
 * 流程：
 * 1. 客户端请求此接口
 * 2. 业务服务器转发到认证服务器的 /api/auth/issue
 * 3. 返回认证服务器的响应
 *
 * 如果认证服务器不可用，返回空 key，后续鉴权会降级为游客
 */

import { NextResponse } from 'next/server';
import { getAuthServiceConfig } from '@/server/platform-config';
import { isAuthServiceAvailable } from '@/lib/api-station/authClient';
import { createLogger } from '@/lib/api-station/logger';

const logger = createLogger('KeyProxy');

export async function POST(request: Request) {
  const config = getAuthServiceConfig();

  // 检查认证服务是否配置
  if (!config || !config.url) {
    logger.warn('认证服务未配置，返回空 key');
    return NextResponse.json({
      key: null,
      error: {
        message: 'Auth service not configured',
        type: 'config_error',
        code: 'AUTH_SERVICE_NOT_CONFIGURED',
      },
    });
  }

  // 检查认证服务是否可用
  if (!(await isAuthServiceAvailable())) {
    logger.warn('认证服务不可用，返回空 key（后续将降级为游客）');
    // 返回空 key，让后续鉴权降级为游客
    return NextResponse.json({
      key: null,
      warning: 'Auth service unavailable, will fallback to guest',
    });
  }

  try {
    // 读取请求体（如果有）
    let body = {};
    try {
      body = await request.json();
    } catch {
      // 空 body，忽略
    }

    // 转发请求到认证服务器
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.verifyTimeoutMs || 5000);

    const response = await fetch(`${config.url}/api/auth/issue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.error('认证服务返回错误', { status: response.status });
      return NextResponse.json({
        key: null,
        error: {
          message: 'Failed to obtain key from auth service',
          type: 'auth_error',
          code: 'AUTH_SERVICE_ERROR',
        },
      });
    }

    const data = await response.json();
    logger.info('成功从认证服务获取 key');

    return NextResponse.json(data);
  } catch (error) {
    logger.error('请求认证服务失败', error);

    // 请求失败，返回空 key（后续降级为游客）
    return NextResponse.json({
      key: null,
      warning: 'Auth service request failed, will fallback to guest',
    });
  }
}
