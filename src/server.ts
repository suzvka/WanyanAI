import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { loadEnv, resolveListenAddress } from 'yunzone-service-kit/config';
import { envLoadOptions, envSchema } from '@/lib/env-schema';

// 部署环境经中立键读取（TICKET-001：平台注入旧名经 deploymentAliases 过渡，禁止裸读）
// .env 文件由 loadEnv 的 dotenv: true 选项自动加载（envLoadOptions 已配置）
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
