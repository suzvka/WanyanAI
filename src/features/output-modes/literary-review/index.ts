import type { OutputModeDefinition } from '../registry';
import { LiteraryReviewRenderer } from './renderer';
import { LITERARY_REVIEW_PROMPT } from './prompt';
import type { LiteraryReviewData, LiteraryReviewRawInput } from './types';
import { reportNeutralMultiplier } from '@/config/reportScoring';
import {
  calculateMultipliers,
  extractAllOptions,
  getSelectedValues,
} from './multiplierCalculator';

/**
 * 验证数据是否为有效的 LiteraryReviewRawInput
 */
function isLiteraryReviewRawInput(data: unknown): data is LiteraryReviewRawInput {
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
 * 文学作品评审输出模式定义
 *
 * 完全自治的输出模式：
 * - 接收原始 JSON 数据 + 元数据
 * - 内部完成验证、标准化、评分、渲染
 */
export const literaryReviewMode: OutputModeDefinition<LiteraryReviewRawInput> = {
  id: 'literary-review',
  name: '文学作品',
  prompt: LITERARY_REVIEW_PROMPT,
  Renderer: LiteraryReviewRenderer,
  validate: isLiteraryReviewRawInput,
  buildScoringContext: ({ moduleConfig, controlSelections }) => {
    const allOptions = extractAllOptions(moduleConfig.analysisControls.groups);
    const selectedValues = getSelectedValues(controlSelections);

    return {
      multipliers: calculateMultipliers(allOptions, selectedValues, reportNeutralMultiplier),
      defaultMultiplier: reportNeutralMultiplier,
    };
  },
};

// === 公开 API ===

// 导出渲染器
export { LiteraryReviewRenderer } from './renderer';
