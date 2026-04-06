/**
 * 文学作品评审模块 - 服务端入口
 *
 * 模块自治架构：
 * - 所有模块代码都在 features/output-modes/literary-review/ 目录下
 * - 工具定义：mcp-tools.ts
 * - 提示词：prompt.ts
 * - 子维度定义：subscores.ts
 * - 评分计算：scoring.ts
 * - 验证逻辑：validate.ts
 * - 渲染器：renderer.tsx（客户端）
 */

import 'server-only';

import type { OutputModeModule, OutputModeRegistry, ProcessInput, ProcessedReportData, BuildScoringContextParams, CollectedToolData } from '@/server/output-modes/types';
import type { ReportScoringContext } from '@/types/analysis';
import { reportNeutralMultiplier, reportBaseScore } from '@/config/reportScoring';
import { createAppError } from '@/types/errors';

// 模块内部导入
import { LITERARY_REVIEW_PROMPT } from './prompt';
import { getLiteraryReviewMcpTools } from './mcp-tools';
import { defaultSubscoreDefinitions, defaultSubscoreIds } from './subscores';
import { calcSubscore, deriveGrade } from './scoring';
import { calculateMultipliers, extractAllOptions, getSelectedValues } from './multiplierCalculator';
import { modelMinimalReportSchema } from './validate';

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
 * 文学作品评审模块定义
 */
export const literaryReviewModule: OutputModeModule = {
  id: 'literary-review',
  name: '文学作品',
  prompt: LITERARY_REVIEW_PROMPT,

  // 多工具模式 - 使用 McpToolDefinition 格式
  mcpToolDefinitions: getLiteraryReviewMcpTools(),

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
      const errors = parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      return { success: false, errors };
    }

    return { success: true, data: parsed.data };
  },

  /**
   * 处理数据：验证 + 标准化 + 评分
   */
  process: (input: ProcessInput): ProcessedReportData => {
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
    const grades: Record<string, string> = {};
    const rationales: Record<string, string> = {};
    for (const subscore of parsed.data.subscores) {
      grades[subscore.id] = subscore.grade;
      rationales[subscore.id] = subscore.rationale;
    }

    // 3. 计算评分
    const definitions = defaultSubscoreDefinitions;
    const multipliers = scoringContext.multipliers;
    const defaultMultiplier = scoringContext.defaultMultiplier;

    let totalScore = 0;
    const subscores: ProcessedReportData['dashboard']['subscores'] = [];

    for (const def of definitions) {
      const grade = grades[def.id] || 'D';
      const rationale = rationales[def.id] || '';
      const multiplier = multipliers[def.id] ?? defaultMultiplier;
      const score = Math.round(calcSubscore(grade as any, multiplier));

      totalScore += score;
      subscores.push({
        id: def.id,
        label: def.label,
        grade,
        score,
        maxScore: reportBaseScore,
        rationale,
      });
    }

    const maxScore = reportBaseScore * definitions.length;
    const overallGrade = deriveGrade(totalScore, maxScore);

    // 4. 构建 sections
    const sections: ProcessedReportData['sections'] = [];
    
    if (parsed.data.sections && parsed.data.sections.length > 0) {
      for (const section of parsed.data.sections) {
        sections.push({
          sectionTitle: section.sectionTitle,
          paragraphTitle: section.paragraphTitle,
          body: section.body,
        });
      }
    }
    const sectionCount = sections.length;

    // 5. 返回标准化数据
    return {
      schemaVersion: 'report_schema_v5_0_ratings',
      reportId,
      reportVersion: metadata.templateVersion,
      generatedAt: createdAt,
      summary: {
        title: parsed.data.summary.title || '概览',
        overview: parsed.data.summary.overview,
      },
      dashboard: {
        totalScore,
        maxScore,
        grade: overallGrade,
        subscores,
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
      sections,
      diagnostics: {
        normalizationMode: 'paragraph-sections',
        sectionCount,
      },
    };
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
   * 支持多次调用同一工具，数据会自动合并
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

    // 拼装为标准格式
    return {
      summary: summaryData || { title: '', overview: '' },
      subscores: subscoresData,
      conclusion: conclusionData || { rationale: '' },
      sections: sectionsData,
    };
  },
};

/**
 * 注册函数
 */
export function register(registry: OutputModeRegistry): void {
  registry.register(literaryReviewModule);
}
