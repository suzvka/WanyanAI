import { NextResponse } from 'next/server';
import { loadEnv } from 'yunzone-service-kit/config';
import { envLoadOptions, envSchema } from '@/lib/env-schema';
import { resolvePlatformCredentials } from '@/lib/platform-auth/client';

/**
 * 运行时配置端点 — 解决 NEXT_PUBLIC_* 构建时内联问题
 * 前端在运行时通过此 API 获取配置，无需重新构建
 * oauthClientId 用于拼授权 URL（/oauth/authorize?client_id=...），
 * 优先取平台注册凭证 PLATFORM_CLIENT_ID；未配置时回退到鉴权中心唯一凭证的
 * 派生 client_id（SHA-256(apiKey)，token_hash 公开字段）。
 * client_secret 永不下发浏览器。
 */
export async function GET() {
  const env = loadEnv(envSchema, envLoadOptions);
  let oauthClientId = '';
  try {
    oauthClientId = resolvePlatformCredentials(env).clientId;
  } catch {
    // 凭证未配置：返回空 client_id，前端展示"配置缺失"提示
  }

  return NextResponse.json({
    platformAuthUrl: env.PLATFORM_AUTH_URL || '',
    oauthClientId,
  });
}