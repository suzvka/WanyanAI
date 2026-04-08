/**
 * 高考作文评分模块 - 服务端入口
 *
 * 模块自治架构：
 * - 所有模块代码都在 features/output-modes/gaokao-essay/ 目录下
 * - 工具定义：mcp-tools.ts
 * - 提示词：prompt.ts
 * - 子维度定义：subscores.ts
 * - 评分计算：scoring.ts
 * - 验证逻辑：validate.ts
 * - 渲染器：renderer.tsx（客户端）
 *
 * 完全独立：不依赖框架的 ProcessedReportData，使用自己的 GaokaoEssayData
 */

import 'server-only';

import type { OutputModeModule, OutputModeRegistry, ProcessInput, BuildScoringContextParams, CollectedToolData } from '@/server/output-modes/types';
import type { ReportScoringContext } from '@/types/analysis';
import type { ReportRating } from '@/config/reportScoring';
import { reportNeutralMultiplier } from '@/config/reportScoring';
import { createAppError } from '@/types/errors';

// 模块内部导入
import { GAOKAO_ESSAY_PROMPT } from './prompt';
import { getGaokaoEssayMcpTools } from './mcp-tools';
import { gaokaoSubscoreDefinitions, gaokaoSubscoreIds } from './subscores';
import { calculate } from './scoring';
import { calculateMultipliers, extractAllOptions, getSelectedValues } from './multiplierCalculator';
import { modelMinimalReportSchema } from './validate';
import type { GaokaoEssayData, GaokaoSectionGroup, GaokaoSection } from './types';

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 从 baseUrl 提取 provider
 */
function getProviderHost(baseUrl: string): string {
  try {
    return new URL(baseUrl).host;
  } catch {
    return 'remote-openai-compatible';
  }
}

// ============================================================================
// 模块定义
// ============================================================================

/**
 * 高考作文评分模块定义
 */
export const gaokaoEssayModule: OutputModeModule = {
  id: 'gaokao-essay',
  name: '高考作文',
  prompt: GAOKAO_ESSAY_PROMPT,

  // 多工具模式 - 使用 McpToolDefinition 格式
  mcpToolDefinitions: getGaokaoEssayMcpTools(),

  /**
   * 验证数据
   */
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

  /**
   * 处理数据：验证 + 标准化 + 评分
   */
  process: (input: ProcessInput): GaokaoEssayData => {
    const { reportId, createdAt, rawJson, metadata, scoringContext } = input;

    // 1. 验证原始数据
    if (!rawJson || typeof rawJson !== 'object') {
      throw createAppError({
        code: 'report_schema_invalid',
        message: '模型未返回有效的分析报告，请重新生成。',
        retryable: true,
      });
    }

    const parsed = modelMinimalReportSchema.safeParse(rawJson);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      throw createAppError({
        code: 'report_schema_invalid',
        message: firstIssue?.message || '模型返回的报告结构不合法',
        retryable: true,
      });
    }

    // 2. 提取 grades 和 rationales
    const grades: Record<string, ReportRating> = {};
    const rationales: Record<string, string> = {};
    for (const subscore of parsed.data.subscores) {
      grades[subscore.id] = subscore.grade as ReportRating;
      rationales[subscore.id] = subscore.rationale;
    }

    // 3. 计算评分（使用权重）
    const multipliers = scoringContext.multipliers;
    const defaultMultiplier = scoringContext.defaultMultiplier;

    const scoreResult = calculate({
      grades,
      rationales,
      definitions: gaokaoSubscoreDefinitions,
      multipliers,
      defaultMultiplier,
    });

    // 4. 构建 sections 和 groups
    const sections: GaokaoSection[] = [];
    const groups: GaokaoSectionGroup[] = [];

    // 优先使用 groups，如果没有则从 sections 生成
    if (parsed.data.groups && parsed.data.groups.length > 0) {
      // 直接使用 groups 和 sections
      for (const group of parsed.data.groups) {
        const groupSections: GaokaoSection[] = [];

        for (const section of group.sections) {
          const sectionId = `${group.id || group.title}::${section.title}`;
          groupSections.push({
            id: sectionId,
            title: section.title,
            body: section.body,
            groupId: group.id || `group-${groups.length}`,
            groupTitle: group.title,
          });
        }

        sections.push(...groupSections);
        groups.push({
          id: group.id || `group-${groups.length}`,
          title: group.title,
          sections: groupSections,
        });
      }
    } else if (parsed.data.sections && parsed.data.sections.length > 0) {
      // 从 sections 生成（分组为默认组）
      const defaultGroupId = 'default-group';
      const defaultGroupTitle = '详细分析';
      const groupSections: GaokaoSection[] = [];

      for (const section of parsed.data.sections) {
        const sectionId = `section-${groupSections.length}`;
        const gaokaoSection: GaokaoSection = {
          id: sectionId,
          title: section.title,
          body: section.body,
          groupId: defaultGroupId,
          groupTitle: defaultGroupTitle,
        };
        groupSections.push(gaokaoSection);
        sections.push(gaokaoSection);
      }

      if (groupSections.length > 0) {
        groups.push({
          id: defaultGroupId,
          title: defaultGroupTitle,
          sections: groupSections,
        });
      }
    }

    // 5. 构建并返回 GaokaoEssayData
    const result: GaokaoEssayData = {
      schemaVersion: 'report_schema_v5_0_ratings',
      reportId,
      reportVersion: metadata.templateVersion,
      generatedAt: createdAt,
      summary: {
        title: parsed.data.summary.title || '概览',
        overview: parsed.data.summary.overview,
      },
      dashboard: {
        totalScore: scoreResult.totalScore,
        maxScore: scoreResult.maxScore,
        grade: scoreResult.grade,
        subscores: scoreResult.subscores.map((s) => ({
          id: s.id,
          label: s.label,
          grade: s.grade,
          score: s.score,
          maxScore: s.maxScore,
          rationale: s.rationale,
        })),
      },
      conclusion: {
        rationale: parsed.data.conclusion.rationale,
      },
      meta: {
        frameworkVersion: metadata.templateVersion,
        scoringPolicyVersion: metadata.scoringPolicyVersion,
        conclusionPolicyVersion: metadata.conclusionPolicyVersion,
        provider: getProviderHost(metadata.baseUrl),
        model: metadata.model,
      },
      groups,
      sections,
      diagnostics: {
        normalizationMode: 'paragraph-sections',
        sectionCount: sections.length,
      },
    };

    return result;
  },

  /**
   * 构建评分上下文
   */
  buildScoringContext: (params: BuildScoringContextParams): ReportScoringContext => {
    const { moduleConfig, controlSelections } = params;
    const allOptions = extractAllOptions(moduleConfig.analysisControls.groups);
    const selectedValues = getSelectedValues(controlSelections);
    return {
      multipliers: calculateMultipliers(allOptions, selectedValues, reportNeutralMultiplier),
      defaultMultiplier: reportNeutralMultiplier,
    };
  },

  /**
   * 拼装报告数据（多工具模式）
   *
   * 从多个工具调用结果中拼装完整的报告数据
   */
  assemble: (collectedData: CollectedToolData): unknown => {
    // 从 collect_summary 获取摘要（只取第一个）
    const summaryData = collectedData.collect_summary?.[0] as {
      title?: string;
      overview: string;
    } | undefined;

    // 从 collect_subscore 获取所有子维度评分（多次调用会合并，按 id 去重取最后一个）
    const subscoresRaw = (collectedData.collect_subscore || []) as Array<{
      id: string;
      label: string;
      grade: string;
      score: number;
      rationale: string;
    }>;

    // 按 id 去重，保留最后一个
    const subscoreMap = new Map<string, typeof subscoresRaw[0]>();
    for (const subscore of subscoresRaw) {
      subscoreMap.set(subscore.id, subscore);
    }
    const subscoresData = Array.from(subscoreMap.values());

    // 从 collect_conclusion 获取结论（只取第一个）
    const conclusionData = collectedData.collect_conclusion?.[0] as {
      rationale: string;
    } | undefined;

    // 从 collect_section 获取所有段落（多次调用会合并，按 sectionTitle + paragraphTitle 去重取最后一个）
    const sectionsRaw = (collectedData.collect_section || []) as Array<{
      sectionTitle: string;
      paragraphTitle: string;
      body: string;
    }>;

    // 按 sectionTitle + paragraphTitle 去重，保留最后一个
    const sectionMap = new Map<string, typeof sectionsRaw[0]>();
    for (const section of sectionsRaw) {
      const key = `${section.sectionTitle}::${section.paragraphTitle}`;
      sectionMap.set(key, section);
    }
    const sectionsData = Array.from(sectionMap.values());

    // 拼装为标准格式（兼容旧 Schema）
    return {
      summary: summaryData || { title: '', overview: '' },
      subscores: subscoresData,
      conclusion: conclusionData || { rationale: '' },
      sections: sectionsData.map(s => ({
        title: s.paragraphTitle,
        body: s.body,
      })),
      // 为了兼容，同时生成 groups
      groups: (() => {
        // 按 sectionTitle 分组
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

/**
 * 注册函数
 */
export function register(registry: OutputModeRegistry): void {
  registry.register(gaokaoEssayModule);
}
