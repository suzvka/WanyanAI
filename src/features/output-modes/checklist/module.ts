/**
 * 评审重点清单输出模式 — 服务端注册
 *
 * 中间模式：根据用户评审配置和待评文本生成针对性评审清单。
 * 无渲染器，结果回注到 Agent 上下文，供终端步骤作为补充提示词。
 */

import 'server-only';

import type { OutputModeModule, OutputModeRegistry, BuildScoringContextParams } from '@/server/output-modes/types';
import type { ReportScoringContext } from '@/types/analysis';
import { reportNeutralMultiplier } from '@/config/reportScoring';

import { CHECKLIST_PROMPT } from './prompt';

export const checklistModule: OutputModeModule = {
  id: 'checklist',
  name: '评审重点清单',
  description:
    '根据用户配置的评审偏好（身份、评分导向、评审维度等）和待评文本内容，生成一份高度针对性的评审重点清单。清单列出文本特征概览、各维度的具体关注点及其文本依据，以及容易被忽略的评审注意事项。Agent 可将清单作为终端步骤的补充提示词。',

  prompt: CHECKLIST_PROMPT,

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
  registry.register(checklistModule);
}
