/**
 * select-control 模块
 *
 * 下拉单选控件模块，迁移自现有的 analysis-controls 逻辑
 */

import 'server-only';

import type { ControlModule, ControlDefinition, CompileResult, RawControlItem } from '../types';
import type { SelectControlConfig, SelectControlItem } from './types';

// ============================================================================
// 辅助函数
// ============================================================================

function findOption(
  control: SelectControlItem,
  value: string,
): SelectControlItem['options'][number] | undefined {
  // 优先使用 value 字段匹配
  if (control.options.some((o) => o.value !== undefined)) {
    return control.options.find((o) => o.value === value && o.enabled);
  }

  // 索引匹配（value 是数字字符串）
  const index = parseInt(value, 10);
  if (!isNaN(index) && index >= 0 && index < control.options.length) {
    const option = control.options[index];
    return option.enabled ? option : undefined;
  }

  return undefined;
}

/** 将 RawControlItem 断言为 SelectControlItem（调用方已保证 type 匹配） */
function asSelectItem(item: RawControlItem): SelectControlItem {
  return item as unknown as SelectControlItem;
}

// ============================================================================
// 模块实现
// ============================================================================

export const selectControlModule: ControlModule = {
  id: 'select',
  name: '下拉选择',

  extractConfig(raw: unknown): RawControlItem[] | null {
    if (!raw) return null;

    // 新格式：扁平数组，每个元素有 type 字段
    if (Array.isArray(raw)) {
      return raw.filter(
        (item): item is RawControlItem =>
          typeof item === 'object' && item !== null && (item as Record<string, unknown>).type === 'select',
      );
    }

    // 兼容旧格式：{ "select": [...] } 或 { "controls": [...] }
    if (typeof raw === 'object') {
      const config = raw as Record<string, unknown>;
      if (Array.isArray(config.select)) {
        return config.select as RawControlItem[];
      }
      if (Array.isArray(config.controls)) {
        return (config.controls as Array<Record<string, unknown>>)
          .filter((c) => c.type === 'select') as RawControlItem[];
      }
    }

    return null;
  },

  getDefinitions(config: RawControlItem[]): ControlDefinition[] {
    if (!config.length) return [];

    return config.flatMap((item) => {
      const control = asSelectItem(item);
      if (control.enabled === false) return [];

      const defaultOpt = control.options.find(
        (o) => (o as Record<string, unknown>).defaultSelected,
      );

      return [{
        id: control.id,
        type: 'select',
        title: control.title,
        initialValue: defaultOpt ? String(defaultOpt.value) : undefined,
        data: {
          options: control.options
            .filter((o) => o.enabled)
            .map((o) => ({ value: o.value, label: o.label })),
        },
      }];
    });
  },

  compile(config: RawControlItem, selections: Record<string, string>): CompileResult {
    const control = asSelectItem(config);
    const selectedValue = selections[control.id];

    if (!selectedValue) return { instruction: '' };

    const option = findOption(control, selectedValue);
    if (!option?.promptText?.trim()) return { instruction: '' };

    return { instruction: option.promptText.trim() };
  },
};

// ============================================================================
// 注册
// ============================================================================

import { controlRegistry } from '../registry';

export function register(): void {
  controlRegistry.register(selectControlModule);
}
