import type { OutputModeDefinition } from '../registry';
import { GaokaoEssayRenderer } from './renderer';
import { GAOKAO_ESSAY_PROMPT } from './prompt';
import type { GaokaoEssayData, GaokaoEssayRawInput } from './types';
import { GAOKAO_NEUTRAL_MULTIPLIER } from './scoring';
import {
  calculateMultipliers,
  extractAllOptions,
  getSelectedValues,
} from './multiplierCalculator';

/**
 * 验证数据是否为有效的 GaokaoEssayRawInput
 */
function isGaokaoEssayRawInput(data: unknown): data is GaokaoEssayRawInput {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const obj = data as Record<string, unknown>;

  return (
    typeof obj.reportId === 'string' &&
    typeof obj.createdAt === 'string' &&
    obj.rawJson !== undefined &&
    obj.metadata !== undefined &&
    obj.scoringContext !== undefined &&
    typeof obj.metadata === 'object'
  );
}

/**
 * 高考作文评分报告输出模式定义
 *
 * 完全自治的输出模式：
 * - 接收原始 JSON 数据 + 元数据
 * - 内部完成验证、标准化、评分、渲染
 * - 满分60分，符合高考作文评分标准
 */
export const gaokaoEssayMode: OutputModeDefinition<GaokaoEssayRawInput> = {
  id: 'gaokao-essay',
  name: '高考作文',
  prompt: GAOKAO_ESSAY_PROMPT,
  Renderer: GaokaoEssayRenderer,
  validate: isGaokaoEssayRawInput,
  buildScoringContext: ({ moduleConfig, controlSelections }) => {
    const allOptions = extractAllOptions(moduleConfig.analysisControls.groups);
    const selectedValues = getSelectedValues(controlSelections);

    return {
      multipliers: calculateMultipliers(allOptions, selectedValues, GAOKAO_NEUTRAL_MULTIPLIER),
      defaultMultiplier: GAOKAO_NEUTRAL_MULTIPLIER,
    };
  },
};

// === 公开 API ===

// 导出渲染器
export { GaokaoEssayRenderer } from './renderer';

// 导出提示词
export { GAOKAO_ESSAY_PROMPT } from './prompt';

// 导出类型
export type { GaokaoEssayData, GaokaoEssayRawInput } from './types';
