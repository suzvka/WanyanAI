/**
 * 乘子计算工具
 * 
 * 从控制选项计算最终乘子
 * - 支持多个选项叠加（累加 delta）
 * - 下限保护：最小值为 0
 * - 未配置的维度使用默认乘子
 * - 使用通用字段提取：直接从选项根级别读取维度字段
 */

import type { SubscoreMultipliers } from './scoring';
import { reportNeutralMultiplier } from '@/config/reportScoring';
import { defaultSubscoreIds } from './subscores';

/** 选项定义（用于乘子计算） */
export type MultiplierOption = {
  /** 选项唯一标识（可选，默认 fallback 为 label） */
  value?: string;
  label?: string;
  /** 自定义字段（维度字段直接在根级别） */
  [key: string]: unknown;
};

/**
 * 获取选项的唯一标识值（value 优先，fallback 为 label）
 */
function resolveOptionId(option: MultiplierOption): string {
  return (typeof option.value === 'string' ? option.value : String(option.label ?? '')) as string;
}

/**
 * 计算最终乘子
 * 
 * @param options - 所有选项定义列表（维度字段直接在根级别）
 * @param selectedValues - 当前选中的值列表
 * @param defaultMultiplier - 默认乘子（默认 1-中性值）
 * @param dimensionIds - 需要计算的维度 ID 列表（默认使用 6 个标准维度）
 * @returns 最终乘子映射（仅包含有变化的维度）
 */
export function calculateMultipliers(
  options: MultiplierOption[],
  selectedValues: string[],
  defaultMultiplier: number = reportNeutralMultiplier,
  dimensionIds: string[] = defaultSubscoreIds,
): SubscoreMultipliers {
  // 1. 从所有选项中构建 id -> option 映射
  const optionMap = new Map<string, MultiplierOption>();
  for (const option of options) {
    optionMap.set(resolveOptionId(option), option);
  }

  // 2. 收集所有涉及到的维度（配置中显式出现的维度）
  const affectedDimensions = new Set<string>();

  // 展开逗号分隔的多选值
  const expandedValues = selectedValues.flatMap((v) =>
    String(v).split(',').map((s) => s.trim()).filter(Boolean),
  );

  for (const value of expandedValues) {
    const option = optionMap.get(value);
    if (option) {
      for (const dim of dimensionIds) {
        if (option[dim] !== undefined) {
          affectedDimensions.add(dim);
        }
      }
    }
  }

  // 3. 计算每个受影响维度的累加 delta
  const multipliers: SubscoreMultipliers = {};
  
  for (const dim of affectedDimensions) {
    // 计算该维度的总 delta
    let totalDelta = 0;
    for (const value of expandedValues) {
      const option = optionMap.get(value);
      const delta = option?.[dim];
      if (typeof delta === 'number') {
        totalDelta += delta;
      }
    }
    
    // 最终乘子 = max(0, defaultMultiplier + delta)
    // 只存储有变化的维度
    const finalMultiplier = Math.max(0, defaultMultiplier + totalDelta);
    if (finalMultiplier !== defaultMultiplier) {
      multipliers[dim] = finalMultiplier;
    }
  }

  return multipliers;
}

import type { ControlConfig } from '@/types/module';

/**
 * 从控件配置中提取所有选项
 * 
 * @param controls - 控件配置数组
 * @returns 所有选项的扁平列表
 */
export function extractAllOptions(controls: ControlConfig[]): MultiplierOption[] {
  const options: MultiplierOption[] = [];
  for (const control of controls) {
    if (control.options) {
      options.push(...(control.options as MultiplierOption[]));
    }
  }
  return options;
}

/**
 * 从控制选择中获取选中的值列表
 * 
 * @param controlSelections - 控制选择映射 { controlId: value }
 * @returns 选中的值列表
 */
export function getSelectedValues(
  controlSelections: Record<string, string>,
): string[] {
  return Object.values(controlSelections);
}
