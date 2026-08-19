import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { loadEnv, resolveListenAddress } from 'yunzone-service-kit/config';
import { envLoadOptions, envSchema } from '@/lib/env-schema';

// Global error handlers to prevent unexpected exits
process.on('uncaughtException', err => {
  console.error('[server] uncaughtException:', err);
  process.exit(1);
});
process.on('unhandledRejection', reason => {
  console.error('[server] unhandledRejection:', reason);
  process.exit(1);
});
// Log when event loop is about to drain (diagnostic for FaaS early-exit)
process.on('beforeExit', code => {
  console.error(`[server] beforeExit: event loop empty, code=${code}`);
});

// 部署环境经中立键读取（TICKET-001：平台注入旧名经 deploymentAliases 过渡，禁止裸读）
// .env 文件由 loadEnv 的 dotenv: true 选项自动加载（envLoadOptions 已配置）
const env = loadEnv(envSchema, envLoadOptions);
const dev = env.DEPLOY_ENV !== 'PROD';
const { host: hostname, port } = resolveListenAddress();

console.log(`[server] starting in ${dev ? 'development' : 'production'} mode on ${hostname}:${port}`);

// Use customServer: false to get a NextServer (same class as `next start` uses internally)
// instead of NextCustomServer. NextServer's prepare() is lighter in production
// (skips server.prepare()) and avoids the heavyweight router-server initialization
// path that can cause premature exit (exit status 0) in FaaS environments.
const app = next({ dev, hostname, port, customServer: false });
const handle = app.getRequestHandler();

// Keep event loop alive during app.prepare() to prevent premature exit in FaaS.
// Use a no-op timer that ref()'s the event loop; cleared once server is listening.
const keepAlive = setInterval(() => {
  // intent: keep event loop alive; no-op callback
}, 30_000);
// Unref is NOT called — we want the timer to keep the process alive.
// (unref is explicitly avoided here.)

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  });
  server.once('error', err => {
    console.error('Server error:', err);
    clearInterval(keepAlive);
    process.exit(1);
  });
  server.listen(port, () => {
    clearInterval(keepAlive);
    // Remove beforeExit listener now that the HTTP server keeps the loop alive
    process.removeAllListeners('beforeExit');
    console.log(
      `> Server listening at http://${hostname}:${port} as ${
        dev ? 'development' : env.DEPLOY_ENV
      }`,
    );
  });
}).catch(err => {
  console.error('Failed to start server:', err);
  clearInterval(keepAlive);
  process.exit(1);
});
