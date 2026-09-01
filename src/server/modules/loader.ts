import 'server-only';

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createLogger } from '@/lib/api-station/logger';
import { validatePageModuleManifest, validatePageModuleContainers } from './schemas';
import { validateSiteConfig } from '@/server/config/schemas';
import type { SiteConfig } from '@/server/config/types';
import { getBuiltInContainerTypes } from '@/containers/manifest';
import { getServerOutputModeIds } from '@/server/output-modes';
import { ensureServerRegistriesInitialized } from '@/lib/bootstrap';
import type { PageModuleConfig, PageModuleRegistry, ControlsConfig } from '@/types/module';

const logger = createLogger('ModuleLoader');

// 控件注册表引用（用于获取控件定义）
import { controlRegistry } from '@/features/controls';

// 注意：ContainerRegistry 是客户端注册表（'use client'），
// 不在此处初始化。客户端容器通过 renderContainer() 的
// 自动初始化守卫或显式调用 initializeContainers() 注册。

const modulesDir = path.join(process.cwd(), 'app-modules');

const DEFAULT_SITE_CONFIG: SiteConfig = {
  home: { title: '功能页面', subtitle: '' },
  inputPanel: { title: '输入内容', description: '' },
  settingsPanel: { title: '分析设置', description: '' },
  progress: { runningTitle: '正在准备分析请求...', runningDescription: '' },
};

/** 控件配置默认值（空数组表示无控件） */
const DEFAULT_CONTROLS: ControlsConfig = [];

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
    logger.debug('扫描到的目录', {
      directories: entries.filter((e: { isDirectory: () => boolean }) => e.isDirectory()).map((e: { name: string }) => e.name)
    });

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

    logger.debug('识别到的模块目录', { count: moduleDirs.length, moduleDirs });

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
 * 解析模块的控件配置
 *
 * 按优先级尝试三种来源（由高到低）：
 * 1. main.json.controlsConfig — 外部文件路径引用（推荐，当前标准）
 * 2. main.json.controls       — 内联数组（适合简单配置）
 * 3. ./controls.json          — 约定文件（自动发现，零配置）
 */
async function resolveControlsConfig(
  moduleDir: string,
  mainJson: Record<string, unknown>,
): Promise<ControlsConfig> {
  // 方式 1：外部文件路径引用（controlsConfig 字段）
  const controlsConfigPath = mainJson.controlsConfig;
  if (typeof controlsConfigPath === 'string' && controlsConfigPath.length > 0) {
    const resolvedPath = path.resolve(moduleDir, controlsConfigPath);
    try {
      const raw = await readFile(resolvedPath, 'utf-8');
      const parsed = JSON.parse(raw);
      return normalizeControlsJson(parsed);
    } catch (err) {
      logger.error('加载外部控件配置失败', err, { resolvedPath });
    }
    return DEFAULT_CONTROLS;
  }

  // 方式 2：内联 controls 数组
  const inlineControls = mainJson.controls;
  if (inlineControls && typeof inlineControls === 'object' && Array.isArray(inlineControls)) {
    return inlineControls as ControlsConfig;
  }

  // 方式 3：约定文件 ./controls.json
  const conventionPath = path.join(moduleDir, 'controls.json');
  try {
    const raw = await readFile(conventionPath, 'utf-8');
    const parsed = JSON.parse(raw);
    return normalizeControlsJson(parsed);
  } catch {
    // 约定文件不存在，使用默认空数组
  }

  return DEFAULT_CONTROLS;
}

/**
 * 标准化控件配置 JSON 为 ControlsConfig[]
 *
 * 兼容两种 JSON 结构：
 * - 数组格式：[{ id, type, ... }, ...]
 * - 对象格式：{ controls: [...], ... }（带包装层）
 */
function normalizeControlsJson(json: unknown): ControlsConfig {
  if (!json || typeof json !== 'object') return DEFAULT_CONTROLS;
  const obj = json as Record<string, unknown>;
  if (Array.isArray(obj)) return obj as ControlsConfig;
  if (Array.isArray(obj.controls)) return obj.controls as ControlsConfig;
  // 无法识别的结构，原样返回（由下游 validate 处理）
  return obj as unknown as ControlsConfig;
}

/**
 * 验证 Agent 管线配置
 *
 * 检查：
 * - 所有步骤的输出模式已在服务端注册表中注册
 * - maxIterations 合法
 * - 步骤池非空
 */
function validateAgentPipeline(
  agent: Record<string, unknown> | undefined,
  slug: string,
): string[] {
  const errors: string[] = [];

  if (!agent || typeof agent !== 'object') {
    return errors; // 未配置 agent，不是错误
  }

  const agentObj = agent as Record<string, unknown>;

  // enabled 检查
  if (agentObj.enabled !== true) {
    return errors; // 未启用
  }

  // maxIterations 验证
  const maxIterations = Number(agentObj.maxIterations);
  if (!Number.isFinite(maxIterations) || maxIterations < 1 || maxIterations > 50) {
    errors.push(`agent.maxIterations 必须在 1-50 之间，当前值: ${agentObj.maxIterations}`);
  }

  // steps 验证
  const steps = agentObj.steps as Array<{ outputMode: string; label: string }> | undefined;
  if (!Array.isArray(steps) || steps.length === 0) {
    errors.push('agent.steps 必须是非空数组');
  } else {
    const serverOutputModeIds = getServerOutputModeIds();
    for (let i = 0; i < steps.length; i += 1) {
      const step = steps[i];
      if (!step || typeof step.outputMode !== 'string' || !step.outputMode) {
        errors.push(`agent.steps[${i}].outputMode 必须是有效字符串`);
      } else if (!serverOutputModeIds.includes(step.outputMode)) {
        errors.push(`agent.steps[${i}].outputMode "${step.outputMode}" 未在输出模式注册表中注册`);
      }
      if (!step || typeof step.label !== 'string' || !step.label) {
        errors.push(`agent.steps[${i}].label 必须是有效字符串`);
      }
    }
  }

  // terminalStep 验证
  const terminalStep = agentObj.terminalStep as { outputMode: string; label: string } | undefined;
  if (!terminalStep || typeof terminalStep.outputMode !== 'string' || !terminalStep.outputMode) {
    errors.push('agent.terminalStep.outputMode 必须是有效字符串');
  } else {
    const serverOutputModeIds = getServerOutputModeIds();
    if (!serverOutputModeIds.includes(terminalStep.outputMode)) {
      errors.push(`agent.terminalStep.outputMode "${terminalStep.outputMode}" 未在输出模式注册表中注册`);
    }
  }
  if (!terminalStep || typeof terminalStep.label !== 'string' || !terminalStep.label) {
    errors.push('agent.terminalStep.label 必须是有效字符串');
  }

  return errors;
}

/**
 * 加载单个模块配置
 */
async function loadModule(moduleDir: string): Promise<PageModuleConfig | null> {
  logger.debug('正在加载模块', { moduleDir });

  const [mainRaw, siteRaw] = await Promise.all([
    readFile(path.join(moduleDir, 'main.json'), 'utf-8'),
    readFile(path.join(moduleDir, 'site.json'), 'utf-8').catch(() => null),
  ]);

  const mainJson = JSON.parse(mainRaw) as Record<string, unknown>;
  const manifest = validatePageModuleManifest(mainJson);

  // 验证容器配置完整性
  const validationErrors = validatePageModuleContainers(
    manifest,
    getBuiltInContainerTypes(),
    getServerOutputModeIds(),
  );

  if (validationErrors.length > 0) {
    logger.warn('模块容器验证失败', { slug: manifest.slug, errorCount: validationErrors.length });
    return null;
  }

  // 验证 Agent 管线配置（如果启用）
  const agentErrors = validateAgentPipeline(manifest.agent, manifest.slug);
  if (agentErrors.length > 0) {
    for (const err of agentErrors) {
      logger.warn('Agent 管线验证失败', { slug: manifest.slug, message: err });
    }
    return null;
  }

  const site = siteRaw ? validateSiteConfig(JSON.parse(siteRaw)) : DEFAULT_SITE_CONFIG;

  // 解析控件配置（统一入口，内部按优先级尝试三种来源）
  const controls = await resolveControlsConfig(moduleDir, mainJson);

  return {
    source: 'published',
    manifest,
    site,
    controls,
    controlDefinitions: controlRegistry.getDefinitions(controls),
  };
}

/**
 * 加载页面模块注册表
 *
 * 扫描 app-modules 目录，验证并加载所有模块配置。
 * 首次调用时自动初始化服务端注册表。
 */
export async function loadPageModuleRegistry(): Promise<PageModuleRegistry> {
  // 确保服务端注册表已初始化（幂等）
  await ensureServerRegistriesInitialized();

  const modules = await scanModules();
  logger.info('已加载模块', { count: modules.length });

  const publicEntries = modules
    .filter((module) => module.manifest.entry.enabled)
    .sort((a, b) => a.manifest.entry.order - b.manifest.entry.order)
    .map((module) => ({
      slug: module.manifest.slug,
      title: module.manifest.title,
      description: module.manifest.description,
      icon: module.manifest.entry.icon,
      landing: module.manifest.entry.landing,
    }));

  logger.debug('已注册的模块', { slugs: publicEntries.map((e) => e.slug) });

  return {
    modules,
    publicEntries,
    getModuleBySlug: (slug: string) => modules.find((m) => m.manifest.slug === slug),
  };
}
