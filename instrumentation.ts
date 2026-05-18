/**
 * Next.js Instrumentation Hook
 *
 * 在服务启动时执行，用于预初始化服务端注册表。
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 每 5 分钟清理一次过期限流记录

export async function register() {
  // 仅在 Node.js 运行时执行（排除 Edge Runtime）
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { ensureServerRegistriesInitialized } = await import('./src/lib/bootstrap');
    await ensureServerRegistriesInitialized();

    // 启动限流过期记录定期清理，避免长期运行内存泄漏
    const { cleanupExpiredRecords } = await import('./src/lib/api-station/rateLimit');
    setInterval(() => {
      try {
        cleanupExpiredRecords();
      } catch {
        // 清理失败不影响主流程
      }
    }, CLEANUP_INTERVAL_MS);
  }
}
