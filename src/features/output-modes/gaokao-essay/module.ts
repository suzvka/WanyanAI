/**
 * 高考作文评分模块 - 服务端入口
 *
 * 模块自治：提示词、工具、评分与验证逻辑全部内聚在本目录下，
 * 框架仅通过 OutputModeModule 接口调度。
 */

import 'server-only';

import type { OutputModeModule, OutputModeRegistry, BuildScoringContextParams, CollectedToolData } from '@/server/output-modes/types';
import type { ReportScoringContext } from '@/types/analysis';
import type { ReportRating } from '@/config/reportScoring';
import { reportNeutralMultiplier } from '@/config/reportScoring';
import { createAppError } from '@/types/errors';

import { GAOKAO_ESSAY_PROMPT } from './prompt';
import { getGaokaoEssayMcpTools } from './mcp-tools';
import { gaokaoSubscoreDefinitions, gaokaoSubscoreIds } from './subscores';
import { calculate } from './scoring';
import { calculateMultipliers, extractAllOptions, getSelectedValues } from './multiplierCalculator';
import { modelMinimalReportSchema } from './validate';
import type { GaokaoEssayData, GaokaoSectionGroup, GaokaoSection } from './types';

function getProviderHost(baseUrl: string): string {
  try {
    return new URL(baseUrl).host;
  } catch {
    return 'remote-openai-compatible';
  }
}

export const gaokaoEssayModule: OutputModeModule = {
  id: 'gaokao-essay',
  name: '高考作文',
  description:
    '按照高考作文评分标准进行评价，覆盖审题立意、内容充实、结构逻辑、语言表达、发展等级（深刻性、创新性）等维度，产出符合高考评分规范的报告。',
  prompt: GAOKAO_ESSAY_PROMPT,

  mcpToolDefinitions: getGaokaoEssayMcpTools(),

  validate: (data: unknown) => {
    // 调试日志
    console.log('[gaokao-essay validate] Raw data:', JSON.stringify(data, null, 2));
    
    if (!data || typeof data !== 'object') {
      return {
        success: false,
        errors: [{ path: '', message: '数据必须是非空对象' }],
      };
    }

    const parsed = modelMinimalReportSchema.safeParse(data);
    if (!parsed.success) {
      // 调试日志：打印详细错误
      console.error('[gaokao-essay validate] Validation failed:', {
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        })),
      });
      
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
