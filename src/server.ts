import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { loadEnv, resolveListenAddress } from 'yunzone-service-kit/config';
import { envLoadOptions, envSchema } from '@/lib/env-schema';

// 统一写 stderr：保证 FaaS/容器平台能透传并采集到用户进程输出
const log = (msg: string): void => {
  process.stderr.write(`[server] ${new Date().toISOString()} ${msg}\n`);
};

// 兜底：Next 16 router-server 会注册“只打印不退出”的 uncaughtException / unhandledRejection，
// 可能把启动链的异步异常静默吞掉，导致“无输出 + exit 0”。先注册更强的处理器让异常可见。
process.on('uncaughtException', err => {
  log(`uncaughtException: ${err?.stack ?? err}`);
  process.exit(1);
});
process.on('unhandledRejection', reason => {
  log(`unhandledRejection: ${String(reason)}`);
  process.exit(1);
});

const env = loadEnv(envSchema, envLoadOptions);

// —— 运行模式判定（修复部署误入 Dev/Turbopack 导致挂起后静默 exit 0）——
// 平台注入旧名 COZE_PROJECT_ENV，经 yunzone-service-kit 的 deploymentAliases 映射为 DEPLOY_ENV，
// 但该回退仅当 DEPLOY_PROVIDER=coze 时生效；而本部署平台未注入 DEPLOY_PROVIDER（=self），
// 导致 DEPLOY_ENV 保持 undefined。旧代码 “dev = DEPLOY_ENV !== 'PROD'” 会因 undefined!=='PROD'
// 误判为 dev 模式 → 生产 .next 构建被无视，Turbopack 在无 TTY/受限 inotify 的 FaaS 里初始化挂起
// → app.prepare() 永不 settle → HTTP server 从未监听 → 事件循环排空 → 进程静默 exit 0。
// 修复：读取归一化 DEPLOY_ENV 或原始 COZE_PROJECT_ENV，仅当平台明确为 DEV 时才走 dev 模式。
const platformEnv = env.DEPLOY_ENV ?? process.env.COZE_PROJECT_ENV;
const dev = platformEnv === 'DEV';

const { port } = resolveListenAddress();
// HOSTNAME 在容器内常为容器 ID，不能作为监听地址；开发/生产统一绑 0.0.0.0
const hostname = '0.0.0.0';

log(
  `mode=${dev ? 'development' : 'production'} (platformEnv=${platformEnv ?? '(unset)'}) ` +
    `listen=${hostname}:${port} node=${process.version}`,
);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// prepare 看门狗：若异步初始化永不 settle（事件循环排空会静默 exit 0），打印状态并 fail-fast，
// 避免“无输出静默退出”再次掩盖根因。
const watchdog = setTimeout(() => {
  const handles =
    (process as any)._getActiveHandles?.().map((h: any) => h.constructor?.name ?? 'unknown').join(', ') ??
    '(n/a)';
  log(`app.prepare() did not settle within 120s (activeHandles=[${handles}]) -> forcing exit(1)`);
  process.exit(1);
}, 120_000);

app
  .prepare()
  .then(() => {
    clearTimeout(watchdog);
    const server = createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url!, true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        log(`Error handling ${req.url}: ${(err as Error)?.message ?? err}`);
        res.statusCode = 500;
        res.end('Internal server error');
      }
    });
    server.once('error', err => {
      log(`Server error: ${err.message}`);
      process.exit(1);
    });
    server.listen(port, hostname, () => {
      log(
        `> Server listening at http://${hostname}:${port} as ${
          dev ? 'development' : env.DEPLOY_ENV ?? 'production'
        }`,
      );
    });
  })
  .catch(err => {
    clearTimeout(watchdog);
    log(`Failed to start server: ${err?.stack ?? err}`);
    process.exit(1);
  });