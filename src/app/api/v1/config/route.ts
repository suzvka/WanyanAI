import { NextResponse } from 'next/server';

/**
 * 运行时配置端点 — 解决 NEXT_PUBLIC_* 构建时内联问题
 * 前端在运行时通过此 API 获取配置，无需重新构建
 */
export async function GET() {
  const userCenterUrl = process.env.USER_CENTER_URL || process.env.NEXT_PUBLIC_USER_CENTER_URL || '';

  // 解析额外允许的 postMessage 来源（逗号分隔，可包含 userCenterUrl 自身的重定向后台域名）
  const allowedOriginsCsv = process.env.USER_CENTER_ALLOWED_ORIGINS || '';
  const additionalOrigins = allowedOriginsCsv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // 去重合并：userCenterUrl 本身 + 额外配置的来源
  const originSet = new Set<string>();
  if (userCenterUrl) originSet.add(userCenterUrl);
  additionalOrigins.forEach((o) => originSet.add(o));
  const allowedOrigins = Array.from(originSet);

  return NextResponse.json({
    userCenterUrl,
    allowedOrigins,
  });
}