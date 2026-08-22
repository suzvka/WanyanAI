import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { loadDotEnv } from 'yunzone-service-kit/config';
// 注意：server.ts 由 tsx watch 运行，其模块解析会经过 Next 的 require-hook，
// 不识别 tsconfig paths（@/ 别名），因此这里必须使用相对路径导入。
import { ensureDatabaseExists } from './config-store/ensureDatabase';

// Capture unhandled errors before anything else so that FaaS deployments
// always surface a clear error message + non-zero exit code on failure.
process.on('uncaughtException', err => {
  console.error('[server] uncaughtException:', err);
  process.exit(1);
});

process.on('unhandledRejection', reason => {
  console.error('[server] unhandledRejection:', reason);
  process.exit(1);
});

// 直读 process.env（不经 yunzone-service-kit/env-schema 初始化链，对齐最后成功部署 f8780ea421 的启动流）。
// 平台会直接注入 COZE_PROJECT_ENV(PROD/DEV)、DEPLOY_RUN_PORT 与 HOSTNAME。
const dev = process.env.COZE_PROJECT_ENV !== 'PROD';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.DEPLOY_RUN_PORT || process.env.PORT || '5000', 10);

console.log(`[server] starting in ${dev ? 'development' : 'production'} mode on ${hostname}:${port}`);

// Create Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  // 启动期加载 .env（不覆盖平台注入），保证直读 process.env 的模块
  // （ConfigStore → createSqlDb → resolveDatabaseUrl 等）能拿到配置。
  // 平台注入优先：loadDotEnv 仅写入未设置的键。
  try {
    const loaded = loadDotEnv();
    if (Object.keys(loaded).length > 0) {
      console.log(`[server] 已加载 .env 配置项 ${Object.keys(loaded).length} 个`);
    }
  } catch (err) {
    console.warn('[server] 加载 .env 失败（忽略，继续启动）:', err);
  }

  // 启动期数据库引导：连接系统库，确保业务库存在（不存在则自动创建）。
  // 失败仅告警不阻塞启动，与"数据库可降级"语义一致。
  try {
    await ensureDatabaseExists();
  } catch (err) {
    console.warn('[server] 数据库引导异常（忽略，继续启动）:', err);
  }

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
    process.exit(1);
  });
  server.listen(port, hostname, () => {
    console.log(
      `> Server listening at http://${hostname}:${port} as ${
        dev ? 'development' : process.env.COZE_PROJECT_ENV
      }`,
    );
  });
}).catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});