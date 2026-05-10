import type { ControlModule, ControlDefinition, CompileResult, RawControlItem } from '../types';
import type { MultiSelectOption } from './types';
import { controlRegistry } from '../registry';

/** RawControlItem → 多选配置的运行时断言（调用方已保证 type='multi-select'） */
function asMultiSelectItem(item: RawControlItem) {
  return item as { id: string; type: 'multi-select'; title?: string; promptText: string; maxSelections?: number; options: MultiSelectOption[] };
}

/**
 * Multi-select 控件模块
 *
 * 编译规则：
 * - 主提示词 + ":\n"
 * - 每个选中项: "- " + 子提示词 + "\n"
 */
export const multiSelectControlModule: ControlModule = {
  id: 'multi-select',
  name: '多选',

  extractConfig(raw: unknown): RawControlItem[] | null {
    if (!raw || !Array.isArray(raw)) return null;
    return raw.filter(
      (item): item is RawControlItem =>
        typeof item === 'object' &&
        item !== null &&
        (item as Record<string, unknown>).type === 'multi-select',
    );
  },

  getDefinitions(config: RawControlItem[]): ControlDefinition[] {
    if (!config.length) return [];

    return config.map((item) => {
      const control = asMultiSelectItem(item);
      const defaults = (control.options ?? [])
        .filter((opt: MultiSelectOption) => opt.defaultSelected)
        .map((opt: MultiSelectOption) => opt.label);

      return {
        id: control.id,
        type: 'multi-select',
        title: control.title,
        initialValue: defaults.length > 0 ? defaults.join(',') : undefined,
        data: {
          promptText: control.promptText,
          maxSelections: control.maxSelections ?? 0,
          options: control.options ?? [],
        },
      } satisfies ControlDefinition;
    });
  },

  compile(config: RawControlItem, selections: Record<string, string>): CompileResult {
    const control = asMultiSelectItem(config);
    const selectedValues = selections[control.id];

    if (!selectedValues || selectedValues === '') return { instruction: '' };

    // 解析多选值（逗号分隔）
    const values = String(selectedValues).split(',').map((s) => s.trim()).filter(Boolean);
    if (values.length === 0) return { instruction: '' };

    const lines: string[] = [`${control.promptText}:`];

    for (const value of values) {
      const option = control.options.find(
        (opt: MultiSelectOption) => opt.label === value,
      );
      if (option?.promptText) {
        lines.push(`- ${option.promptText}`);
      }
    }

    return { instruction: lines.join('\n') };
  },
};

export function register(): void {
  controlRegistry.register(multiSelectControlModule);
}
