import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import { getReportBuffer, createWrappedFetch } from 'coze-coding-dev-sdk';
import { loadDotEnv, loadEnv as loadSchemaEnv } from 'yunzone-service-kit/config';
import { envSchema, envLoadOptions } from '@/lib/env-schema';

let envLoaded = false;

interface SupabaseCredentials {
  url: string;
  anonKey: string;
}

/**
 * 平台环境变量注入（本地模拟 Coze 注入通道）：
 * 1. 本地 .env 文件加载（不存在时静默跳过）
 * 2. 通过 coze_workload_identity 拉取平台项目环境变量写入 process.env
 *
 * 读取请使用 loadSchemaEnv(envSchema)：SUPABASE_* 中立键优先，
 * 平台注入的 COZE_SUPABASE_* 经 envLoadOptions.aliases 回退（TICKET-001）；
 * 此处对 process.env 的访问属于平台注入适配，不落入服务代码裸读（TICKET-001）。
 */
const hasSupabaseCreds = (env: NodeJS.ProcessEnv): boolean =>
  (env.SUPABASE_URL || env.COZE_SUPABASE_URL) !== undefined &&
  (env.SUPABASE_ANON_KEY || env.COZE_SUPABASE_ANON_KEY) !== undefined;

function loadPlatformEnvVars(): void {
  if (envLoaded || hasSupabaseCreds(process.env)) {
    return;
  }

  try {
    // 本地 .env 文件加载（不存在时静默跳过）
    loadDotEnv();
    if (hasSupabaseCreds(process.env)) {
      envLoaded = true;
      return;
    }

    const pythonCode = `
import os
import sys
try:
    from coze_workload_identity import Client
    client = Client()
    env_vars = client.get_project_env_vars()
    client.close()
    for env_var in env_vars:
        print(f"{env_var.key}={env_var.value}")
except Exception as e:
    print(f"# Error: {e}", file=sys.stderr)
`;

    const output = execSync(`python3 -c '${pythonCode.replace(/'/g, "'\"'\"'")}'`, {
      encoding: 'utf-8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const lines = output.trim().split('\n');
    for (const line of lines) {
      if (line.startsWith('#')) continue;
      const eqIndex = line.indexOf('=');
      if (eqIndex > 0) {
        const key = line.substring(0, eqIndex);
        let value = line.substring(eqIndex + 1);
        if ((value.startsWith("'") && value.endsWith("'")) ||
            (value.startsWith('"') && value.endsWith('"'))) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }

    envLoaded = true;
  } catch {
    // Silently fail
  }
}

function getSupabaseCredentials(): SupabaseCredentials {
  loadPlatformEnvVars();

  // TICKET-001：统一经 schema 读取中立键（平台注入 COZE_* 由 aliases 回退），禁止裸读
  const env = loadSchemaEnv(envSchema, envLoadOptions);
  const url = env.SUPABASE_URL;
  const anonKey = env.SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error('SUPABASE_URL is not set');
  }
  if (!anonKey) {
    throw new Error('SUPABASE_ANON_KEY is not set');
  }

  return { url, anonKey };
}

function getSupabaseServiceRoleKey(): string | undefined {
  loadPlatformEnvVars();
  return loadSchemaEnv(envSchema, envLoadOptions).SUPABASE_SERVICE_ROLE_KEY;
}

function getSupabaseClient(token?: string): SupabaseClient {
  const { url, anonKey } = getSupabaseCredentials();

  let key: string;
  if (token) {
    key = anonKey;
  } else {
    const serviceRoleKey = getSupabaseServiceRoleKey();
    key = serviceRoleKey ?? anonKey;
  }

  const globalOptions: Record<string, any> = {};
  if (token) {
    globalOptions.headers = { Authorization: `Bearer ${token}` };
  }
  try {
    const buffer = getReportBuffer();
    if (buffer) {
      globalOptions.fetch = createWrappedFetch(buffer, 'supabase');
    }
  } catch {
    // Silent — reporting setup failure should not block client creation
  }

  return createClient(url, key, {
    global: globalOptions,
    db: {
      timeout: 60000,
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export { loadPlatformEnvVars, getSupabaseCredentials, getSupabaseServiceRoleKey, getSupabaseClient };
