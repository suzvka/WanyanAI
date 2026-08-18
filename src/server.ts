import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { loadDotEnv, loadEnv, resolveListenAddress } from 'yunzone-service-kit/config';
import { envLoadOptions, envSchema } from '@/lib/env-schema';

// 本地 .env 文件加载（不存在时静默跳过；部署只需拷贝 .env 到项目目录）
loadDotEnv();

// 部署环境经中立键读取（TICKET-001：平台注入旧名经 deploymentAliases 过渡，禁止裸读）
const env = loadEnv(envSchema, envLoadOptions);
const dev = env.DEPLOY_ENV !== 'PROD';
const { host: hostname, port } = resolveListenAddress();

// Create Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

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
    process.exit(1);
  });
  server.listen(port, () => {
    console.log(
      `> Server listening at http://${hostname}:${port} as ${
        dev ? 'development' : env.DEPLOY_ENV
      }`,
    );
  });
}).catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
