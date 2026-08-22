import { NextResponse } from 'next/server';
import { loadEnv } from 'yunzone-service-kit/config';
import { envLoadOptions, envSchema } from '@/lib/env-schema';
import { deriveClientId } from '@/lib/platform-auth/client';

/**
 * 运行时配置端点 — 解决 NEXT_PUBLIC_* 构建时内联问题
 * 前端在运行时通过此 API 获取配置，无需重新构建
 * oauthClientId 为鉴权中心唯一凭证的派生 client_id（token_hash，公开字段），
 * 浏览器仅需 client_id 拼授权 URL，client_secret 永不下发。
 */
export async function GET() {
  const env = loadEnv(envSchema, envLoadOptions);
  return NextResponse.json({
    platformAuthUrl: env.PLATFORM_AUTH_URL || '',
    oauthClientId: env.AUTH_CENTER_API_KEY ? deriveClientId(env.AUTH_CENTER_API_KEY) : '',
  });
}