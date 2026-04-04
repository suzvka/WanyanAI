'use client';

import { useMemo } from 'react';
import type { SubscoreDefinition } from './subscores';
import type { GaokaoEssayData, GaokaoEssayRawInput } from './types';
import { scoring } from './scoring';
import { gaokaoSubscoreDefinitions } from './subscores';
import {
  modelMinimalReportSchema,
  type ModelMinimalSection,
  type ModelMinimalSectionGroup,
  type ModelMinimalSubscore,
} from './validate';
import { GaokaoEssayView } from './components/GaokaoEssayView';
import type { RendererProps } from '../registry';
import { createAppError } from '@/types/errors';
import { evaluationGoalLabels } from '@/config/evaluationDimensions';

/**
 * 从原始数据中提取评价目标标签
 */
function getGoalLabel(evaluationGoal: string): string {
  return evaluationGoalLabels[evaluationGoal as keyof typeof evaluationGoalLabels] || evaluationGoal;
}

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

/**
 * 高考作文评分报告渲染器
 * 
 * 完全自治的输出模式渲染器：
 * 1. 接收原始 JSON 数据 + 元数据 + 评分上下文
 * 2. 内部验证数据结构
 * 3. 内部标准化为 GaokaoEssayData
 * 4. 内部计算评分（满分60分）
 * 5. 内部渲染完整的报告视图
 */
export function GaokaoEssayRenderer({
  data,
  subscoreDefinitions,
  defaultMultiplier,
  onStartNew,
  onBackToEdit,
}: RendererProps<GaokaoEssayRawInput> & {
  /** 自定义子维度定义（默认使用高考作文6个维度） */
  subscoreDefinitions?: SubscoreDefinition[];
  /** 默认乘子（默认1-中性值） */
  defaultMultiplier?: number;
}) {
  const effectiveDefaultMultiplier = defaultMultiplier ?? data.scoringContext.defaultMultiplier;
  const multipliers = data.scoringContext.multipliers;

  // 验证 + 标准化 + 评分
  const scoredReport = useMemo(() => {
    const definitions = subscoreDefinitions ?? gaokaoSubscoreDefinitions;

    // 0. 检查原始数据是否存在
    if (!data.rawJson || typeof data.rawJson !== 'object') {
      throw createAppError({
        code: 'report_schema_invalid',
        message: '模型未返回有效的分析报告，请重新生成。',
        retryable: true,
      });
    }

    // 1. 验证原始数据
    const parsed = modelMinimalReportSchema.safeParse(data.rawJson);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      let errorMessage = firstIssue?.message || '模型返回的报告结构不合法';
      
      throw createAppError({
        code: 'report_schema_invalid',
        message: errorMessage,
        retryable: true,
      });
    }

    // 2. 标准化为 GaokaoEssayData
    const { metadata } = data;
    const normalizedReport: GaokaoEssayData = {
      schemaVersion: 'gaokao_essay_v1_0',
      reportId: data.reportId,
      reportVersion: metadata.templateVersion,
      generatedAt: data.createdAt,
      summary: {
        title: parsed.data.summary.title || `${getGoalLabel(metadata.evaluationGoal)}概览`,
        overview: parsed.data.summary.overview,
      },
      dashboard: {
        totalScore: 0,
        maxScore: 60,
        grade: 'D',
        subscores: parsed.data.subscores.map((subscore: ModelMinimalSubscore) => ({
          id: subscore.id,
          label: definitions.find(d => d.id === subscore.id)?.label ?? subscore.id,
          grade: subscore.grade,
          score: 0,
          maxScore: 0,
          rationale: subscore.rationale,
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
      groups: parsed.data.groups?.map((group: ModelMinimalSectionGroup, groupIndex: number) => ({
        id: group.id?.trim() || `group-${groupIndex + 1}`,
        title: group.title,
        sections: group.sections.map((section: ModelMinimalSection, sectionIndex: number) => ({
          id: `section-${group.id || groupIndex + 1}-${sectionIndex + 1}`,
          title: section.title,
          body: section.body,
          groupId: group.id?.trim() || `group-${groupIndex + 1}`,
          groupTitle: group.title,
        })),
      })) ?? [],
      sections: [],
      diagnostics: {
        normalizationMode: 'paragraph-sections',
        sectionCount: parsed.data.groups?.reduce((acc: number, g: ModelMinimalSectionGroup) => acc + g.sections.length, 0) ?? 0,
      },
    };

    // 兼容旧格式：如果没有 groups，使用 sections
    if (normalizedReport.groups.length === 0 && parsed.data.sections) {
      normalizedReport.sections = parsed.data.sections.map((section: ModelMinimalSection, index: number) => ({
        id: `section-root-${index + 1}`,
        title: section.title,
        body: section.body,
      }));
      normalizedReport.diagnostics.sectionCount = normalizedReport.sections.length;
    } else {
      normalizedReport.sections = normalizedReport.groups.flatMap(g => g.sections);
    }

    // 3. 提取 grades 和 rationales
    // 将 S/A/B/C/D 映射到 ReportRating
    const gradeMap: Record<string, 'S' | 'A' | 'B' | 'C' | 'D'> = {
      S: 'S',
      A: 'A',
      B: 'B',
      C: 'C',
      D: 'D',
    };
    
    const grades: Record<string, 'S' | 'A' | 'B' | 'C' | 'D'> = {};
    const rationales: Record<string, string> = {};

    for (const subscore of normalizedReport.dashboard.subscores) {
      grades[subscore.id] = gradeMap[subscore.grade as keyof typeof gradeMap] || 'D';
      rationales[subscore.id] = subscore.rationale;
    }

    // 4. 调用评分计算（满分60分）
    const scoreResult = scoring.calculate({
      grades,
      rationales,
      definitions,
      multipliers,
        defaultMultiplier: effectiveDefaultMultiplier,
    });

    // 5. 合并计算结果到报告数据
    return {
      ...normalizedReport,
      dashboard: {
        ...normalizedReport.dashboard,
        totalScore: scoreResult.totalScore,
        maxScore: scoreResult.maxScore,
        grade: scoreResult.grade,
        subscores: scoreResult.subscores,
      },
    };
  }, [data, subscoreDefinitions, multipliers, effectiveDefaultMultiplier]);

  return (
    <GaokaoEssayView
      report={scoredReport}
      onStartNew={onStartNew}
      onBackToEdit={onBackToEdit}
    />
  );
}
