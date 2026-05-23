/**
 * 高考作文评分模块 - 服务端入口
 *
 * 模块自治：提示词、工具、评分与验证逻辑全部内聚在本目录下，
 * 框架仅通过 OutputModeModule 接口调度。
 */

import 'server-only';

import type { OutputModeModule, OutputModeRegistry, BuildScoringContextParams, CollectedToolData, ToolCallResolutionResult } from '@/server/output-modes/types';
import type { ReportScoringContext } from '@/types/analysis';
import { reportNeutralMultiplier } from '@/config/reportScoring';

import { GAOKAO_ESSAY_PROMPT } from './prompt';
import { getGaokaoEssayMcpTools } from './mcp-tools';
import { calculateMultipliers, extractAllOptions, getSelectedValues } from './multiplierCalculator';
import { modelMinimalReportSchema } from './validate';

export const gaokaoEssayModule: OutputModeModule = {
  id: 'gaokao-essay',
  name: '高考作文',
  description:
    '按照高考作文评分标准进行评价，覆盖审题立意、内容充实、结构逻辑、语言表达、发展等级（深刻性、创新性）等维度，产出符合高考评分规范的报告。',
  prompt: GAOKAO_ESSAY_PROMPT,

  mcpToolDefinitions: getGaokaoEssayMcpTools(),

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

  resolveToolCall: (toolName: string, _params: Record<string, unknown>): ToolCallResolutionResult => {
    // 模块自己声明业务工具的框架语义
    // finalize_report：提示词约定，给 LLM 一个明确的结束信号；
    // 即使 LLM 遗漏，流结束时的 autoFinalized 机制也会兜底触发 assemble
    if (toolName === 'finalize_report') {
      return { type: 'finalize' };
    }
    // collect_summary / collect_subscore 等 → 默认收集，无特殊语义
    return { type: 'unknown' };
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
      sections: sectionsData.map(s => ({
        title: s.paragraphTitle,
        body: s.body,
      })),
      groups: (() => {
        const groupMap = new Map<string, Array<{ title: string; body: string }>>();
        for (const section of sectionsData) {
          if (!groupMap.has(section.sectionTitle)) {
            groupMap.set(section.sectionTitle, []);
          }
          groupMap.get(section.sectionTitle)!.push({
            title: section.paragraphTitle,
            body: section.body,
          });
        }

        return Array.from(groupMap.entries()).map(([title, sections], index) => ({
          id: `group-${index}`,
          title,
          sections,
        }));
      })(),
    };
  },
};

export function register(registry: OutputModeRegistry): void {
  registry.register(gaokaoEssayModule);
}
