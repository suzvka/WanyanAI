import { NextResponse } from 'next/server';
import { loadEnv } from 'yunzone-service-kit/config';
import { envSchema } from '@/lib/env-schema';

/**
 * 运行时配置端点 — 解决 NEXT_PUBLIC_* 构建时内联问题
 * 前端在运行时通过此 API 获取配置，无需重新构建
 */
export async function GET() {
  const env = loadEnv(envSchema);
  return NextResponse.json({
    userCenterUrl: env.USER_CENTER_URL || env.NEXT_PUBLIC_USER_CENTER_URL || '',
  });
}