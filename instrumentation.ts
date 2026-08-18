/**
 * Next.js Instrumentation Hook
 *
 * 在服务启动时执行，用于预初始化服务端注册表。
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // 仅在 Node.js 运行时执行（排除 Edge Runtime）
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // .env 文件由全局 loadEnv 的 dotenv: true 选项自动加载（envLoadOptions 已配置），
    // 此处无需手动 loadDotEnv；但 ensureServerRegistriesInitialized 内部会调用
    // loadEnv(envSchema, envLoadOptions)，.env 在此过程中自动加载
    const { ensureServerRegistriesInitialized } = await import('./src/lib/bootstrap');
    await ensureServerRegistriesInitialized();

    // 限流过期记录定期清理（限流统一在 /api/v1/chat/completions 入口执行，清理在此统一管理）
    const { cleanupExpiredRecords } = await import('./src/lib/api-station/rateLimit');
    setInterval(cleanupExpiredRecords, 5 * 60 * 1000);
  }
}
