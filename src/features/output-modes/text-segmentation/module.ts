/**
 * 文本分段输出模式 — 服务端注册
 *
 * 中间模式：将输入文本按逻辑结构分段，返回格式化文本结果。
 * 无渲染器，结果回注到 Agent 上下文。
 */

import 'server-only';

import type { OutputModeModule, OutputModeRegistry, BuildScoringContextParams } from '@/server/output-modes/types';
import type { ReportScoringContext } from '@/types/analysis';
import { reportNeutralMultiplier } from '@/config/reportScoring';

import { TEXT_SEGMENTATION_PROMPT } from './prompt';

export const textSegmentationModule: OutputModeModule = {
  id: 'text-segmentation',
  name: '文本分段',
  description:
    '将输入文本按逻辑结构划分段落，分析每段核心主题和内容摘要，总结整体结构特点（如总分总、并列、递进等）。适用于对长文本进行结构化拆解。',

  prompt: TEXT_SEGMENTATION_PROMPT,

  validate: (data: unknown) => {
    // 中间模式不进行结构化验证，原样通过
    return { success: true, data };
  },

  buildScoringContext: (_params: BuildScoringContextParams): ReportScoringContext => ({
    multipliers: {},
    defaultMultiplier: reportNeutralMultiplier,
  }),
};

export function register(registry: OutputModeRegistry): void {
  registry.register(textSegmentationModule);
}
