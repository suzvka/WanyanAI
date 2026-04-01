/**
 * 内置 API 配置
 * 提供站内模型服务的配置信息
 */

import type { ModelInfo, ApiConfigValidationStatus } from '@/types/modelConfig';

const BROWSER_ID_KEY = 'browser_id';
const BUILT_IN_CACHE_KEY = 'built_in_models_cache';

// 内置模式缓存结构
interface BuiltInModelsCache {
  models: ModelInfo[];
  validationStatus: ApiConfigValidationStatus;
  selectedModel: string | null;
  cachedAt: string;
}

/**
 * 生成新的浏览器 ID（UUID v4 格式）
 */
function generateBrowserId(): string {
  return crypto.randomUUID();
}

/**
 * 获取内置 API 的认证密钥
 * 
 * 当前实现：返回浏览器 ID（保底默认）
 * 未来扩展：可结合账号系统返回用户 token
 */
export function getBuiltInApiKey(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  let browserId = localStorage.getItem(BROWSER_ID_KEY);
  
  if (!browserId) {
    browserId = generateBrowserId();
    localStorage.setItem(BROWSER_ID_KEY, browserId);
  }

  return browserId;
}

/**
 * 获取内置 API 的基础 URL
 * 指向当前服务器的 /api/v1 端点
 */
export function getBuiltInBaseUrl(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  return `${window.location.origin}/api/v1`;
}

/**
 * 内置配置的固定名称
 */
export const BUILT_IN_CONFIG_NAME = '站内模型服务';

/**
 * 获取内置模式的缓存
 * 返回模型列表、验证状态和选中的模型
 */
export function getBuiltInModelsCache(): BuiltInModelsCache | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const cacheStr = localStorage.getItem(BUILT_IN_CACHE_KEY);
    if (!cacheStr) {
      return null;
    }
    return JSON.parse(cacheStr) as BuiltInModelsCache;
  } catch {
    return null;
  }
}

/**
 * 保存内置模式的缓存
 * @param models 模型列表
 * @param validationStatus 验证状态
 * @param selectedModel 选中的模型 ID
 */
export function saveBuiltInModelsCache(
  models: ModelInfo[],
  validationStatus: ApiConfigValidationStatus,
  selectedModel: string | null
): void {
  if (typeof window === 'undefined') {
    return;
  }

  const cache: BuiltInModelsCache = {
    models,
    validationStatus,
    selectedModel,
    cachedAt: new Date().toISOString(),
  };

  localStorage.setItem(BUILT_IN_CACHE_KEY, JSON.stringify(cache));
}

/**
 * 清除内置模式的缓存
 */
export function clearBuiltInModelsCache(): void {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.removeItem(BUILT_IN_CACHE_KEY);
}
