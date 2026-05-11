/**
 * 控件注册表
 *
 * 采用延迟初始化模式：
 * - 单例实例在模块加载时创建（无副作用）
 * - 内置控件通过 initialize() 显式注册
 * - 支持 reset() 用于测试隔离和热重置
 */

import 'server-only';

import { createLogger } from '@/lib/api-station/logger';
import { BaseRegistry } from '@/lib/registry/BaseRegistry';
import type { ControlModule, ControlRegistry, MergerFn, CompileResult, RawControlItem, ControlDefinition } from './types';
import { registerBuiltinControls } from './manifest';

const logger = createLogger('ControlRegistry');

// ============================================================================
// 默认合并函数
// ============================================================================

function defaultMerger(results: CompileResult[]): CompileResult {
  const instructions = results
    .map((r) => r.instruction)
    .filter(Boolean);

  return { instruction: instructions.join('\n') };
}

// ============================================================================
// 注册表实现
// ============================================================================

class ControlRegistryImpl extends BaseRegistry<ControlModule> implements ControlRegistry {
  private merger: MergerFn = defaultMerger;

  constructor() {
    super('ControlRegistry');
  }

  compileAll(
    rawConfig: unknown,
    selections: Record<string, string>,
  ): CompileResult {
    const results: CompileResult[] = [];
    const controls = this.normalizeToArray(rawConfig);

    for (const control of controls) {
      const controlModule = this.modules.get(control.type);
      if (!controlModule) {
        logger.warn('未找到控件类型', { controlType: control.type });
        continue;
      }

      const controlSelection = selections[control.id];

      try {
        const result = controlModule.compile(control, { [control.id]: controlSelection ?? '' });
        results.push(result);
      } catch (error) {
        logger.error('控件编译失败', error, { controlId: control.id, controlType: control.type });
      }
    }

    return this.merger(results);
  }

  private normalizeToArray(rawConfig: unknown): RawControlItem[] {
    if (!rawConfig || typeof rawConfig !== 'object') {
      return [];
    }

    const config = rawConfig as Record<string, unknown>;

    if (Array.isArray(config)) {
      return config.filter((item): item is RawControlItem =>
        typeof item === 'object' && item !== null && typeof item.id === 'string' && typeof item.type === 'string'
      );
    }

    // 分组结构兼容：按类型分发到各模块 extractConfig
    const result: RawControlItem[] = [];
    for (const controlModule of this.modules.values()) {
      const moduleConfig = controlModule.extractConfig(config);
      if (moduleConfig !== null && Array.isArray(moduleConfig)) {
        for (const item of moduleConfig) {
          result.push({ ...(item as RawControlItem), type: controlModule.id });
        }
      }
    }

    return result;
  }

  setMerger(fn: MergerFn): void {
    this.merger = fn;
  }

  getMerger(): MergerFn {
    return this.merger;
  }

  getDefinitions(rawConfig: unknown): ControlDefinition[] {
    const controls = this.normalizeToArray(rawConfig);
    const allDefinitions: ControlDefinition[] = [];

    const grouped = new Map<string, RawControlItem[]>();
    for (const control of controls) {
      const group = grouped.get(control.type) ?? [];
      group.push(control);
      grouped.set(control.type, group);
    }

    for (const [type, groupControls] of grouped) {
      const controlModule = this.modules.get(type);
      if (!controlModule) {
        logger.warn('getDefinitions: 未找到控件类型', { controlType: type });
        continue;
      }
      try {
        const definitions = controlModule.getDefinitions(groupControls);
        allDefinitions.push(...definitions);
      } catch (error) {
        logger.error('getDefinitions: 控件类型处理失败', error, { controlType: type });
      }
    }

    return allDefinitions;
  }
}

// ============================================================================
// 单例导出 + 延迟初始化 API
// ============================================================================

/** 控件注册表单例 */
export const controlRegistry: ControlRegistryImpl = new ControlRegistryImpl();

/**
 * 初始化控件注册表（注册所有内置控件）
 *
 * 幂等操作，重复调用不会重复注册。
 * 必须在使用 controlRegistry 之前调用。
 */
export function initializeControls(): void {
  controlRegistry.initialize(registerBuiltinControls);
}
