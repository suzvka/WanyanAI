/**
 * 乘子计算工具（高考作文专用）
 * 
 * 从控制选项计算最终乘子
 * - 支持多个选项叠加（累加 delta）
 * - 下限保护：最小值为 0
 * - 未配置的维度使用默认乘子
 * - 使用通用字段提取：直接从选项根级别读取维度字段
 */

import type { SubscoreMultipliers } from './scoring';
import { GAOKAO_NEUTRAL_MULTIPLIER } from './scoring';
import { gaokaoSubscoreIds } from './subscores';

/** 选项定义（用于乘子计算） */
export type MultiplierOption = {
  value: string;
  /** 自定义字段（维度字段直接在根级别） */
  [key: string]: unknown;
};

/**
 * 计算最终乘子
 * 
 * @param options - 所有选项定义列表
 * @param selectedValues - 当前选中的值列表
 * @param defaultMultiplier - 默认乘子（默认 1-中性值）
 * @param dimensionIds - 需要计算的维度 ID 列表
 * @returns 最终乘子映射（仅包含有变化的维度）
 */
export function calculateMultipliers(
  options: MultiplierOption[],
  selectedValues: string[],
  defaultMultiplier: number = GAOKAO_NEUTRAL_MULTIPLIER,
  dimensionIds: string[] = gaokaoSubscoreIds,
): SubscoreMultipliers {
  // 从所有选项中构建 value -> option 映射
  const optionMap = new Map<string, MultiplierOption>();
  for (const option of options) {
    optionMap.set(option.value, option);
  }

  // 收集所有涉及到的维度
  const affectedDimensions = new Set<string>();
  for (const value of selectedValues) {
    const option = optionMap.get(value);
    if (option) {
      for (const dim of dimensionIds) {
        if (option[dim] !== undefined) {
          affectedDimensions.add(dim);
        }
      }
    }
  }

  // 计算每个受影响维度的累加 delta
  const multipliers: SubscoreMultipliers = {};
  
  for (const dim of affectedDimensions) {
    let totalDelta = 0;
    for (const value of selectedValues) {
      const option = optionMap.get(value);
      const delta = option?.[dim];
      if (typeof delta === 'number') {
        totalDelta += delta;
      }
    }
    
    const finalMultiplier = Math.max(0, defaultMultiplier + totalDelta);
    if (finalMultiplier !== defaultMultiplier) {
      multipliers[dim] = finalMultiplier;
    }
  }

  return multipliers;
}

/**
 * 从模块配置中提取所有选项
 */
export function extractAllOptions(groups: Array<{
  controls: Array<{
    options: MultiplierOption[];
  }>;
}>): MultiplierOption[] {
  const options: MultiplierOption[] = [];
  for (const group of groups) {
    for (const control of group.controls) {
      options.push(...control.options);
    }
  }
  return options;
}

/**
 * 从控制选择中获取选中的值列表
 */
export function getSelectedValues(
  controlSelections: Record<string, string>,
): string[] {
  return Object.values(controlSelections);
}
