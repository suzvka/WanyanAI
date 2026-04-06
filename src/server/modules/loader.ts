import 'server-only';

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { validateModuleManifest, validateModuleContainers } from './schemas';
import { createFallbackModuleConfig } from './fallback';
import { validateSiteConfig, validateAnalysisControls, normalizeAnalysisControls } from '@/server/config/schemas';
import { getServerOutputModeIds } from '@/server/output-modes';
import type { ModuleConfig, ModuleRegistry } from '@/types/module';

/**
 * 内置容器类型列表（服务端固定）
 */
const BUILTIN_CONTAINER_TYPES = ['analysis-controls', 'text-blocks'];

const modulesDir = path.join(process.cwd(), 'app-modules');

/**
 * 检查目录是否包含 main.json
 */
async function isModuleDirectory(dirPath: string): Promise<boolean> {
  try {
    const mainPath = path.join(dirPath, 'main.json');
    await readFile(mainPath, 'utf-8');
    return true;
  } catch {
    return false;
  }
}

/**
 * 扫描并加载所有模块（并行加载）
 */
async function scanModules(): Promise<ModuleConfig[]> {
  try {
    const entries = await readdir(modulesDir, { withFileTypes: true });

    // 第一步：并行检查所有目录是否为模块目录
    const dirChecks = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
          const moduleDir = path.join(modulesDir, entry.name);
          const isModule = await isModuleDirectory(moduleDir);
          return { entry, moduleDir, isModule };
        }),
    );

    // 过滤出真正的模块目录
    const moduleDirs = dirChecks
      .filter((check) => check.isModule)
      .map((check) => check.moduleDir);

    // 第二步：并行加载所有模块
    const results = await Promise.allSettled(
      moduleDirs.map((moduleDir) => loadModule(moduleDir)),
    );

    // 收集成功加载的模块
    const modules: ModuleConfig[] = [];
    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        modules.push(result.value);
      }
    });

    return modules;
  } catch (error) {
    // app-modules 目录不存在，返回空列表
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

/**
 * 加载单个模块配置
 */
async function loadModule(moduleDir: string): Promise<ModuleConfig | null> {
  const [mainRaw, siteRaw, analysisControlsRaw] = await Promise.all([
    readFile(path.join(moduleDir, 'main.json'), 'utf-8'),
    readFile(path.join(moduleDir, 'site.json'), 'utf-8').catch(() => null),
    readFile(path.join(moduleDir, 'analysis-controls.json'), 'utf-8').catch(() => null),
  ]);

  const manifest = validateModuleManifest(JSON.parse(mainRaw));

  // 验证容器配置完整性（动态获取已注册的输出模式列表）
  const validationErrors = validateModuleContainers(
    manifest,
    BUILTIN_CONTAINER_TYPES,
    getServerOutputModeIds(),
  );

  if (validationErrors.length > 0) {
    return null;
  }

  let site = createFallbackModuleConfig().site;
  if (siteRaw) {
    site = validateSiteConfig(JSON.parse(siteRaw));
  }

  let analysisControls = createFallbackModuleConfig().analysisControls;
  if (analysisControlsRaw) {
    const parsed = JSON.parse(analysisControlsRaw);
    analysisControls = normalizeAnalysisControls(parsed);
  }

  return {
    source: 'published',
    manifest,
    site,
    analysisControls,
  };
}

/**
 * 创建模块注册表
 */
export async function loadModuleRegistry(): Promise<ModuleRegistry> {
  const modules = await scanModules();

  // 如果没有找到任何模块，返回 fallback
  if (modules.length === 0) {
    const fallback = createFallbackModuleConfig();
    return {
      modules: [fallback],
      getModuleById: (id: string) => (id === fallback.manifest.id ? fallback : undefined),
      getModuleByRoute: (route: string) => (route === fallback.manifest.route ? fallback : undefined),
    };
  }

  return {
    modules,
    getModuleById: (id: string) => modules.find((m) => m.manifest.id === id),
    getModuleByRoute: (route: string) => modules.find((m) => m.manifest.route === route),
  };
}
