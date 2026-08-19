import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { loadEnv, resolveListenAddress } from 'yunzone-service-kit/config';
import { envLoadOptions, envSchema } from '@/lib/env-schema';

// ── Diagnostic helpers ──
let _keepAliveTimer: ReturnType<typeof setInterval> | null = null;

function log(msg: string) {
  console.log(`[server] ${msg}`);
}
function warn(msg: string) {
  console.warn(`[server] ${msg}`);
}
function activeHandles() {
  // @ts-ignore - internal API for diagnostics
  const handles: unknown[] = process._getActiveHandles?.() ?? [];
  const types = handles.map(h => {
    const ctor = (h as object).constructor?.name;
    if (ctor === 'Timer') {
      // @ts-ignore
      const isRef = (h as any)._refCount !== undefined ? (h as any)._refCount > 0 : true;
      return `${ctor}(ref=${isRef})`;
    }
    return ctor || 'unknown';
  });
  return types.join(', ') || '(none)';
}

// ── Global error handlers ──
process.on('uncaughtException', err => {
  console.error('[server] uncaughtException:', err);
  process.exit(1);
});
process.on('unhandledRejection', reason => {
  console.error('[server] unhandledRejection:', reason);
  process.exit(1);
});
process.on('beforeExit', code => {
  console.error(`[server] beforeExit: code=${code}, activeHandles=[${activeHandles()}]`);
});
process.on('exit', code => {
  console.error(`[server] exit: code=${code}`);
});

// ── Load env ──
log('step 1: loadEnv...');
const env = loadEnv(envSchema, envLoadOptions);
log(`step 1 done: DEPLOY_ENV=${env.DEPLOY_ENV}, CONFIG_STORE=${env.CONFIG_STORE}`);

const dev = env.DEPLOY_ENV !== 'PROD';
const { host: hostname, port } = resolveListenAddress();
log(`step 2: resolveListenAddress -> ${hostname}:${port}`);

log(`[server] starting in ${dev ? 'development' : 'production'} mode on ${hostname}:${port}`);

// ── Create Next.js app ──
log('step 3: next({ dev, hostname, port, customServer: false })...');
const app = next({ dev, hostname, port, customServer: false });
log('step 3 done');

log('step 4: app.getRequestHandler()...');
const handle = app.getRequestHandler();
log('step 4 done');

// Keep event loop alive during app.prepare() to prevent premature exit in FaaS.
log(`step 5: setInterval keepAlive (activeHandles before=[${activeHandles()}])`);
_keepAliveTimer = setInterval(() => {
  log(`[keepAlive] tick, activeHandles=[${activeHandles()}]`);
}, 5_000);
log(`step 5 done: keepAlive set, activeHandles=[${activeHandles()}]`);

// ── Prepare & start ──
log('step 6: app.prepare()...');
app.prepare().then(() => {
  log('step 6 done: app.prepare() resolved');
  log(`step 7: createServer, activeHandles=[${activeHandles()}]`);

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
    if (_keepAliveTimer) clearInterval(_keepAliveTimer);
    process.exit(1);
  });
  server.listen(port, () => {
    if (_keepAliveTimer) clearInterval(_keepAliveTimer);
    process.removeAllListeners('beforeExit');
    log(`> Server listening at http://${hostname}:${port} as ${
      dev ? 'development' : env.DEPLOY_ENV
    }`);
    log(`activeHandles after listen=[${activeHandles()}]`);
  });
}).catch(err => {
  console.error('Failed to start server:', err);
  if (_keepAliveTimer) clearInterval(_keepAliveTimer);
  process.exit(1);
});