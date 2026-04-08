import 'server-only';

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { validatePageModuleManifest, validatePageModuleContainers } from './schemas';
import { validateAnalysisControls, validateSiteConfig } from '@/server/config/schemas';
import type { SiteConfig, AnalysisControlsConfig } from '@/server/config/types';
import { getBuiltInContainerTypes } from '@/containers/manifest';
import { getServerOutputModeIds } from '@/server/output-modes';
import type { PageModuleConfig, PageModuleRegistry } from '@/types/module';

const modulesDir = path.join(process.cwd(), 'app-modules');

const DEFAULT_SITE_CONFIG: SiteConfig = {
  home: {
    title: '功能页面',
    subtitle: '',
  },
  inputPanel: {
    title: '输入内容',
    description: '',
  },
  settingsPanel: {
    title: '分析设置',
    description: '',
  },
  progress: {
    runningTitle: '正在准备分析请求...',
    runningDescription: '',
  },
};

const DEFAULT_ANALYSIS_CONTROLS: AnalysisControlsConfig = {
  groups: [
    {
      id: 'default',
      title: '默认分组',
      enabled: true,
      controls: [],
    },
  ],
  controls: [],
};

type ModuleDirectoryCheck = {
  moduleDir: string;
  isModule: boolean;
};

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
async function scanModules(): Promise<PageModuleConfig[]> {
  try {
    const entries = await readdir(modulesDir, { withFileTypes: true });

    // 第一步：并行检查所有目录是否为模块目录
    const dirChecks = await Promise.all(
      entries
        .filter((entry: { isDirectory: () => boolean }) => entry.isDirectory())
        .map(async (entry: { name: string }) => {
          const moduleDir = path.join(modulesDir, entry.name);
          const isModule = await isModuleDirectory(moduleDir);
          return { moduleDir, isModule } as ModuleDirectoryCheck;
        }),
    );

    // 过滤出真正的模块目录
    const moduleDirs = dirChecks
      .filter((check: ModuleDirectoryCheck) => check.isModule)
      .map((check: ModuleDirectoryCheck) => check.moduleDir);

    // 第二步：并行加载所有模块
    const results = await Promise.allSettled(
      moduleDirs.map((moduleDir: string) => loadModule(moduleDir)),
    );

    // 收集成功加载的模块
    const modules: PageModuleConfig[] = [];
    results.forEach((result: PromiseSettledResult<PageModuleConfig | null>) => {
      if (result.status === 'fulfilled' && result.value) {
        modules.push(result.value);
      }
    });

    return modules;
  } catch (error) {
    // app-modules 目录不存在，返回空列表
    if ((error as { code?: string }).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

/**
 * 加载单个模块配置
 */
async function loadModule(moduleDir: string): Promise<PageModuleConfig | null> {
  const [mainRaw, siteRaw, analysisControlsRaw] = await Promise.all([
    readFile(path.join(moduleDir, 'main.json'), 'utf-8'),
    readFile(path.join(moduleDir, 'site.json'), 'utf-8').catch(() => null),
    readFile(path.join(moduleDir, 'analysis-controls.json'), 'utf-8').catch(() => null),
  ]);

  const manifest = validatePageModuleManifest(JSON.parse(mainRaw));

  // 验证容器配置完整性（动态获取已注册的输出模式列表）
  const validationErrors = validatePageModuleContainers(
    manifest,
    getBuiltInContainerTypes(),
    getServerOutputModeIds(),
  );

  if (validationErrors.length > 0) {
    return null;
  }

  let site = DEFAULT_SITE_CONFIG;
  if (siteRaw) {
    site = validateSiteConfig(JSON.parse(siteRaw));
  }

  let analysisControls = DEFAULT_ANALYSIS_CONTROLS;
  if (analysisControlsRaw) {
    analysisControls = validateAnalysisControls(JSON.parse(analysisControlsRaw));
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
export async function loadPageModuleRegistry(): Promise<PageModuleRegistry> {
  const modules = await scanModules();
  const publicEntries = modules
    .filter((module) => module.manifest.entry.enabled)
    .sort((a, b) => a.manifest.entry.order - b.manifest.entry.order)
    .map((module) => ({
      slug: module.manifest.slug,
      title: module.manifest.title,
      description: module.manifest.description,
    }));

  return {
    modules,
    publicEntries,
    getModuleBySlug: (slug: string) => modules.find((m) => m.manifest.slug === slug),
  };
}
