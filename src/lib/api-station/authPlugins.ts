/**
 * 鉴权插件加载器
 *
 * 运行时动态加载部署时注入的认证函数：
 * - key-validators/：Key 格式验证器（在调用认证服务前执行）
 * - auth-verifiers/：鉴权响应验证器（在收到认证服务响应后执行）
 *
 * 约定：
 * - 每个策略放在独立子文件夹中，入口文件为 main.js
 * - main.js 通过 module.exports 导出一个函数
 * - 所有验证器依次执行，全部返回 true 才通过
 * - 无任何验证器时默认放行
 */

import { existsSync, readdirSync, type Dirent } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

// ========== 类型定义 ==========

/** Key 格式验证器入参 */
export interface KeyValidatorParams {
  key: string | null;
}

/** Key 格式验证器函数签名 */
export type KeyValidatorFn = (params: KeyValidatorParams) => boolean;

/** 鉴权响应验证器入参 */
export interface AuthVerifierParams {
  /** 原始请求 key */
  key: string;
  /** 认证服务器返回的权限等级（唯一必填业务字段） */
  permissionLevel: number;
  /** 认证服务器返回的身份标识 */
  identityId?: string;
  /** 认证服务器返回的所有额外字段（原样透传） */
  authPayload: unknown;
}

/** 鉴权响应验证器函数签名 */
export type AuthVerifierFn = (params: AuthVerifierParams) => boolean;

// ========== 缓存 ==========

const PROJECT_ROOT = process.cwd();

const KEY_VALIDATORS_DIR = 'key-validators';
const AUTH_VERIFIERS_DIR = 'auth-verifiers';

let keyValidatorsCache: KeyValidatorFn[] | null = null;
let authVerifiersCache: AuthVerifierFn[] | null = null;

// ========== 加载逻辑 ==========

/**
 * 扫描目录，加载所有子文件夹中的 main.js
 */
function loadPluginsFromDir<T>(dirName: string): T[] {
  const dir = path.join(PROJECT_ROOT, dirName);

  if (!existsSync(dir)) {
    return [];
  }

  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true }) as Dirent[];
  } catch {
    return [];
  }

  // 使用 createRequire 确保能正确解析相对路径
  const customRequire = createRequire(path.join(PROJECT_ROOT, 'package.json'));

  const plugins: T[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const mainPath = path.join(dir, entry.name, 'main.js');

    if (!existsSync(mainPath)) {
      console.warn(`[AuthPlugins] 跳过 ${entry.name}：缺少 main.js`);
      continue;
    }

    try {
      // 清除 require 缓存，支持热更新（开发环境）
      delete customRequire.cache[customRequire.resolve(mainPath)];

      const mod = customRequire(mainPath);

      if (typeof mod === 'function') {
        plugins.push(mod as T);
        console.log(`[AuthPlugins] 已加载插件：${dirName}/${entry.name}`);
      } else if (mod && typeof mod.default === 'function') {
        plugins.push(mod.default as T);
        console.log(`[AuthPlugins] 已加载插件（default 导出）：${dirName}/${entry.name}`);
      } else {
        console.warn(`[AuthPlugins] 跳过 ${entry.name}：main.js 未导出函数`);
      }
    } catch (error) {
      console.error(`[AuthPlugins] 加载 ${dirName}/${entry.name} 失败:`, error);
    }
  }

  return plugins;
}

/**
 * 获取所有 Key 格式验证器（带缓存）
 */
export function getKeyValidators(): KeyValidatorFn[] {
  if (keyValidatorsCache === null) {
    keyValidatorsCache = loadPluginsFromDir<KeyValidatorFn>(KEY_VALIDATORS_DIR);
    console.log(`[AuthPlugins] 已加载 ${keyValidatorsCache.length} 个 Key 格式验证器`);
  }
  return keyValidatorsCache;
}

/**
 * 获取所有鉴权响应验证器（带缓存）
 */
export function getAuthVerifiers(): AuthVerifierFn[] {
  if (authVerifiersCache === null) {
    authVerifiersCache = loadPluginsFromDir<AuthVerifierFn>(AUTH_VERIFIERS_DIR);
    console.log(`[AuthPlugins] 已加载 ${authVerifiersCache.length} 个鉴权响应验证器`);
  }
  return authVerifiersCache;
}

// ========== 执行逻辑 ==========

/**
 * 执行 Key 格式验证
 *
 * @returns true = 全部通过（或无需验证），false = 被拒绝
 */
export function validateKey(key: string | null): boolean {
  const validators = getKeyValidators();

  // 无验证器 → 默认放行
  if (validators.length === 0) {
    return true;
  }

  for (const validator of validators) {
    try {
      if (!validator({ key })) {
        return false;
      }
    } catch {
      // 验证器抛异常视为不通过
      return false;
    }
  }

  return true;
}

/**
 * 执行鉴权响应验证
 *
 * @returns true = 全部通过（或无需验证），false = 认证无效
 */
export function verifyAuthResponse(params: AuthVerifierParams): boolean {
  const verifiers = getAuthVerifiers();

  // 无验证器 → 默认放行
  if (verifiers.length === 0) {
    return true;
  }

  for (const verifier of verifiers) {
    try {
      if (!verifier(params)) {
        return false;
      }
    } catch {
      // 验证器抛异常视为不通过
      return false;
    }
  }

  return true;
}

/**
 * 清除插件缓存（用于测试或强制重载）
 */
export function clearAuthPluginsCache(): void {
  keyValidatorsCache = null;
  authVerifiersCache = null;
}
