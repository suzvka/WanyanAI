import { NextResponse } from 'next/server';

/**
 * 运行时配置端点 — 解决 NEXT_PUBLIC_* 构建时内联问题
 * 前端在运行时通过此 API 获取配置，无需重新构建
 */
export async function GET() {
  return NextResponse.json({
    userCenterUrl: process.env.USER_CENTER_URL || process.env.NEXT_PUBLIC_USER_CENTER_URL || '',
  });
}