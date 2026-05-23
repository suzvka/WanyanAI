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
    const { ensureServerRegistriesInitialized } = await import('./src/lib/bootstrap');
    await ensureServerRegistriesInitialized();

    // 限流的过期记录清理已迁移至各中转站内部管理
  }
}
