/**
 * 文学作品评审模块 - 服务端入口
 *
 * 模块自治：提示词、工具、评分与验证逻辑全部内聚在本目录下，
 * 框架仅通过 OutputModeModule 接口调度。
 */

import 'server-only';

import type { OutputModeModule, OutputModeRegistry, BuildScoringContextParams, CollectedToolData } from '@/server/output-modes/types';
import type { ReportScoringContext } from '@/types/analysis';
import { reportNeutralMultiplier } from '@/config/reportScoring';

import { LITERARY_REVIEW_PROMPT } from './prompt';
import { getLiteraryReviewMcpTools } from './mcp-tools';
import { calculateMultipliers, extractAllOptions, getSelectedValues } from './multiplierCalculator';
import { modelMinimalReportSchema } from './validate';

export const literaryReviewModule: OutputModeModule = {
  id: 'literary-review',
  name: '文学作品',
  description:
    '对文学作品进行多维度评审，涵盖语言表现力、结构逻辑、人文深度、审美张力、内涵凝聚力、共情效能六个子维度，产出带评级的详细评审报告。',
  prompt: LITERARY_REVIEW_PROMPT,

  mcpToolDefinitions: getLiteraryReviewMcpTools(),

  validate: (data: unknown) => {
    if (!data || typeof data !== 'object') {
      return {
        success: false,
        errors: [{ path: '', message: '数据必须是非空对象' }],
      };
    }

    const parsed = modelMinimalReportSchema.safeParse(data);
    if (!parsed.success) {
      const errors: Array<{ path: string; message: string }> = [];
      for (const issue of parsed.error.issues as Array<{ path: Array<string | number>; message: string }>) {
        errors.push({
          path: issue.path.join('.'),
          message: issue.message,
        });
      }
      return { success: false, errors };
    }

    return { success: true, data: parsed.data };
  },

  buildScoringContext: (params: BuildScoringContextParams): ReportScoringContext => {
    const { moduleConfig, controlSelections } = params;
    const allOptions = extractAllOptions(moduleConfig.controls);
    const selectedValues = getSelectedValues(controlSelections);
    return {
      multipliers: calculateMultipliers(allOptions, selectedValues, reportNeutralMultiplier),
      defaultMultiplier: reportNeutralMultiplier,
    };
  },

  assemble: (collectedData: CollectedToolData): unknown => {
    const summaryData = collectedData.collect_summary?.[0] as {
      title?: string;
      overview: string;
    } | undefined;

    const subscoresRaw = (collectedData.collect_subscore || []) as Array<{
      id: string;
      label?: string;
      grade: string;
      score?: number;
      rationale: string;
    }>;

    const subscoreMap = new Map<string, typeof subscoresRaw[0]>();
    for (const subscore of subscoresRaw) {
      subscoreMap.set(subscore.id, subscore);
    }
    
    // 只保留验证 schema 需要的字段
    const subscoresData = Array.from(subscoreMap.values()).map((s) => ({
      id: s.id,
      grade: s.grade,
      rationale: s.rationale,
    }));

    const conclusionData = collectedData.collect_conclusion?.[0] as {
      rationale: string;
    } | undefined;

    const sectionsRaw = (collectedData.collect_section || []) as Array<{
      sectionTitle: string;
      paragraphTitle: string;
      body: string;
    }>;

    const sectionMap = new Map<string, typeof sectionsRaw[0]>();
    for (const section of sectionsRaw) {
      const key = `${section.sectionTitle}::${section.paragraphTitle}`;
      sectionMap.set(key, section);
    }
    const sectionsData = Array.from(sectionMap.values());

    return {
      summary: summaryData || { title: '', overview: '' },
      subscores: subscoresData,
      conclusion: conclusionData || { rationale: '' },
      sections: sectionsData,
    };
  },
};

export function register(registry: OutputModeRegistry): void {
  registry.register(literaryReviewModule);
}
