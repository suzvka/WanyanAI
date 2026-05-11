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
 * 如果认证服务器不可用，返回临时 key，后续鉴权会跳过格式校验
 */

import { NextResponse } from 'next/server';
import { getAuthServiceConfig } from '@/server/platform-config';
import { isAuthServiceAvailable } from '@/lib/api-station/authClient';
import { createLogger } from '@/lib/api-station/logger';

const logger = createLogger('KeyProxy');

/**
 * 生成临时 key
 * 格式：temp_<timestamp>_<random>
 * 注意：这不是标准格式，认证服务不可用时鉴权会跳过格式校验
 */
function generateTempKey(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function POST(request: Request) {
  const config = getAuthServiceConfig();

  // 检查认证服务是否配置
  if (!config || !config.url) {
    logger.warn('认证服务未配置，返回临时 key');
    return NextResponse.json({
      key: generateTempKey(),
      expiresAt: Date.now() + 5 * 60 * 1000,
      warning: 'Auth service not configured',
    });
  }

  // 检查认证服务是否可用
  if (!(await isAuthServiceAvailable())) {
    logger.warn('认证服务不可用，返回临时 key');
    return NextResponse.json({
      key: generateTempKey(),
      expiresAt: Date.now() + 5 * 60 * 1000,
      warning: 'Auth service unavailable',
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
      logger.error('认证服务返回错误，返回临时 key', { status: response.status });
      return NextResponse.json({
        key: generateTempKey(),
        expiresAt: Date.now() + 5 * 60 * 1000,
        warning: 'Auth service error',
      });
    }

    const data = await response.json();
    logger.info('成功从认证服务获取 key');

    return NextResponse.json(data);
  } catch (error) {
    logger.error('请求认证服务失败，返回临时 key', error);

    return NextResponse.json({
      key: generateTempKey(),
      expiresAt: Date.now() + 5 * 60 * 1000,
      warning: 'Auth service request failed',
    });
  }
}
