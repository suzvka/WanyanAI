import 'server-only';

import { loadPageModuleRegistry } from './loader';
import type { PageModuleRegistry, PageModuleConfig, PageModulePublicMeta } from '@/types/module';

let cachedRegistry: PageModuleRegistry | null = null;

/**
 * 获取缓存的模块注册表
 */
function getCachedModuleRegistry(): PageModuleRegistry | null {
  return cachedRegistry;
}

/**
 * 设置缓存的模块注册表
 */
function setCachedPageModuleRegistry(registry: PageModuleRegistry): PageModuleRegistry {
  cachedRegistry = registry;
  return registry;
}

/**
 * 获取模块注册表（带缓存）
 */
export async function getPageModuleRegistry(): Promise<PageModuleRegistry> {
  const cached = getCachedModuleRegistry();
  if (cached) {
    return cached;
  }

  const registry = await loadPageModuleRegistry();
  return setCachedPageModuleRegistry(registry);
}

/**
 * 根据 slug 获取页面模块配置
 */
export async function getPageModuleBySlug(slug: string): Promise<PageModuleConfig | undefined> {
  const registry = await getPageModuleRegistry();
  return registry.getModuleBySlug(slug);
}

/**
 * 获取所有完整页面模块列表
 */
export async function getAllPageModules(): Promise<PageModuleConfig[]> {
  const registry = await getPageModuleRegistry();
  return registry.modules;
}

/**
 * 获取页面模块公开入口列表
 */
export async function getPageModulePublicEntries(): Promise<PageModulePublicMeta[]> {
  const registry = await getPageModuleRegistry();
  return registry.publicEntries;
}
