import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { loadEnv, resolveListenAddress } from 'yunzone-service-kit/config';
import { envLoadOptions, envSchema } from '@/lib/env-schema';

// ── Diagnostic helpers ──
let _keepAliveTimer: ReturnType<typeof setInterval> | null = null;
const _logFile = '/tmp/server-debug-' + process.pid + '.log';
let _logStream: import('fs').WriteStream | null = null;

function debugLog(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  // stdout
  process.stdout.write(line);
  // file
  if (!_logStream) {
    try {
      const fs = require('fs') as typeof import('fs');
      _logStream = fs.createWriteStream(_logFile, { flags: 'a' });
      _logStream.on('error', () => { _logStream = null; });
    } catch { /* ignore */ }
  }
  _logStream?.write(line);
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
  process.stdout.write(`[${new Date().toISOString()}] uncaughtException: ${err.message}\n${err.stack}\n`);
  process.exit(1);
});
process.on('unhandledRejection', reason => {
  process.stdout.write(`[${new Date().toISOString()}] unhandledRejection: ${String(reason)}\n`);
  process.exit(1);
});
process.on('beforeExit', code => {
  debugLog(`beforeExit: code=${code}, activeHandles=[${activeHandles()}]`);
});
process.on('exit', code => {
  try {
    process.stdout.write(`[${new Date().toISOString()}] exit: code=${code}, activeHandles=[${activeHandles()}]\n`);
  } catch { /* ignore */ }
  _logStream?.end();
});

// ── Keep event loop alive ──
// 1) dummy TCP server on random port — most reliable in FaaS
import { createServer as createNetServer } from 'net';
const _dummyKeepAlive = createNetServer();
_dummyKeepAlive.listen(0, '127.0.0.1');
debugLog(`step 0a: dummy net.Server on random port, activeHandles=[${activeHandles()}]`);

// 2) stdin resume as backup
try {
  process.stdin.resume();
  debugLog(`step 0b: stdin.resume() called, readable=${process.stdin.readable}, flowing=${process.stdin.readableFlowing}, activeHandles=[${activeHandles()}]`);
} catch (e: any) {
  debugLog(`step 0b: stdin.resume() FAILED: ${e.message}`);
}

// 3) interval as last resort
_keepAliveTimer = setInterval(() => {
  debugLog(`[keepAlive] tick, activeHandles=[${activeHandles()}]`);
}, 10_000);

// Also log the module load state
process.nextTick(() => {
  debugLog(`[nextTick] module loaded, keepAlive=${_keepAliveTimer !== null}, dummyServer=${_dummyKeepAlive.listening}, activeHandles=[${activeHandles()}]`);
});

// ── Load env ──
debugLog('step 1: loadEnv...');
const env = loadEnv(envSchema, envLoadOptions);
debugLog(`step 1 done: DEPLOY_ENV=${env.DEPLOY_ENV}, CONFIG_STORE=${env.CONFIG_STORE}`);

const dev = env.DEPLOY_ENV !== 'PROD';
const { host: hostname, port } = resolveListenAddress();
debugLog(`step 2: resolveListenAddress -> ${hostname}:${port}`);

debugLog(`starting in ${dev ? 'development' : 'production'} mode on ${hostname}:${port}`);

// ── Create Next.js app ──
debugLog('step 3: next({ dev, hostname, port, customServer: false })...');
const app = next({ dev, hostname, port, customServer: false });
debugLog('step 3 done');

debugLog('step 4: app.getRequestHandler()...');
const handle = app.getRequestHandler();
debugLog('step 4 done');

// ── Prepare & start ──
debugLog('step 5: app.prepare()...');
app.prepare().then(() => {
  debugLog('step 5 done: app.prepare() resolved');
  debugLog(`step 6: createServer, activeHandles=[${activeHandles()}]`);

  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      debugLog(`Error handling ${req.url}: ${err}`);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  });
  server.once('error', err => {
    debugLog(`Server error: ${err.message}`);
    if (_keepAliveTimer) clearInterval(_keepAliveTimer);
    _dummyKeepAlive.close();
    process.exit(1);
  });
  server.listen(port, () => {
    clearInterval(_keepAliveTimer!);
    _keepAliveTimer = null;
    process.removeAllListeners('beforeExit');
    _dummyKeepAlive.close();
    debugLog(`> Server listening at http://${hostname}:${port} as ${
      dev ? 'development' : env.DEPLOY_ENV
    }`);
    debugLog(`activeHandles after listen=[${activeHandles()}]`);
  });
}).catch(err => {
  debugLog(`Failed to start server: ${err.message}\n${err.stack}`);
  if (_keepAliveTimer) clearInterval(_keepAliveTimer);
  _dummyKeepAlive.close();
  process.exit(1);
});