import type { PageModuleConfig as ModuleConfig, ControlConfig } from '@/types/module';

/**
 * 获取已启用的控件列表（扁平结构）
 */
export function buildActiveControlSelections(
  controls: ControlConfig[],
  selections: Record<string, string>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const ctrl of controls) {
    if ('value' in ctrl && ctrl.value !== undefined) {
      result[ctrl.id] = selections[ctrl.id] ?? ctrl.value;
    }
  }
  return result;
}

export function getEnabledDynamicControls(
  moduleConfig: ModuleConfig,
): ControlConfig[] {
  return moduleConfig.controls.filter((control) => control.enabled && control.options?.length > 0);
}

/**
 * 解析控件的当前有效值
 *
 * 默认值已由控件模块在 getDefinitions() 中通过 initialValue 字段交付，
 * PageContext 在初始化时已将其填入 controlSelections。
 * 此函数仅处理运行时值的解析。
 */
export function resolveControlSelectionValue(
  control: ControlConfig,
  currentValue: string | undefined,
): string {
  if (control.options.length === 0) return '';

  // 有有效当前值 → 直接使用
  if (currentValue) return currentValue;

  // 无默认值逻辑 —— 初始值由数据层（PageContext / initialValue）负责
  return '';
}

export function resolveInitialControlSelections(controls: ControlConfig[]) {
  return Object.fromEntries(
    controls.map((control) => [control.id, resolveControlSelectionValue(control, undefined)]),
  );
}

export function synchronizeControlSelections(
  controls: ControlConfig[],
  currentSelections: Record<string, string>,
): Record<string, string> {
  const updated = { ...currentSelections };

  for (const control of controls) {
    if (!control.enabled || control.options.length === 0) continue;

    const current = updated[control.id];
    if (!current || !control.options.some((opt) => 'value' in opt && (opt as { value: string }).value === current)) {
      updated[control.id] = '';
    }
  }

  return updated;
}
