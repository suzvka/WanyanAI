import 'server-only';

import { loadModuleRegistry } from './loader';
import type { ModuleRegistry, ModuleConfig } from '@/types/module';

let cachedRegistry: ModuleRegistry | null = null;

/**
 * 获取缓存的模块注册表
 */
export function getCachedModuleRegistry(): ModuleRegistry | null {
  return cachedRegistry;
}

/**
 * 设置缓存的模块注册表
 */
export function setCachedModuleRegistry(registry: ModuleRegistry): ModuleRegistry {
  cachedRegistry = registry;
  return registry;
}

/**
 * 获取模块注册表（带缓存）
 */
export async function getModuleRegistry(): Promise<ModuleRegistry> {
  const cached = getCachedModuleRegistry();
  if (cached) {
    return cached;
  }

  const registry = await loadModuleRegistry();
  return setCachedModuleRegistry(registry);
}

/**
 * 根据 ID 获取模块配置
 */
export async function getModuleById(id: string): Promise<ModuleConfig | undefined> {
  const registry = await getModuleRegistry();
  return registry.getModuleById(id);
}

/**
 * 获取所有模块列表
 */
export async function getAllModules(): Promise<ModuleConfig[]> {
  const registry = await getModuleRegistry();
  return registry.modules;
}
