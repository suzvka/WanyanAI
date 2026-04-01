'use client';

import { useMemo } from 'react';
import { usePageContext } from '@/providers/PageContext';
import type { SubscoreMultipliers } from './scoring';
import type { SubscoreDefinition } from './subscores';
import type { ReportJsonData, ReportJsonRawInput } from './types';
import { scoring } from './scoring';
import { defaultSubscoreDefinitions } from './subscores';
import {
  calculateMultipliers,
  extractAllOptions,
  getSelectedValues,
} from './multiplierCalculator';
import { modelMinimalReportSchema } from './validate';
import { ReportJsonView } from './components/ReportJsonView';
import type { RendererProps } from '../registry';
import { createAppError } from '@/types/errors';
import { evaluationGoalLabels } from '@/config/evaluationDimensions';
import type { ReportRating } from '@/config/reportScoring';

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
 * report-json 渲染器组件
 *
 * 完全自治的输出模式渲染器：
 * 1. 接收原始 JSON 数据 + 元数据
 * 2. 内部验证数据结构
 * 3. 内部标准化为 ReportJsonData
 * 4. 内部计算 multipliers
 * 5. 内部计算评分
 * 6. 内部渲染完整的报告视图
 */
export function ReportJsonRenderer({
  data,
  subscoreDefinitions,
  defaultMultiplier,
  onStartNew,
  onBackToEdit,
}: RendererProps<ReportJsonRawInput> & {
  /** 自定义子维度定义（默认使用6个标准维度） */
  subscoreDefinitions?: SubscoreDefinition[];
  /** 默认乘子（默认4） */
  defaultMultiplier?: number;
}) {
  // 从 PageContext 获取需要的数据
  const { moduleConfig, controlSelections } = usePageContext();

  // 内部计算 multipliers
  const multipliers = useMemo(() => {
    const allOptions = extractAllOptions(moduleConfig.analysisControls.groups);
    const selectedValues = getSelectedValues(controlSelections);
    return calculateMultipliers(allOptions, selectedValues, defaultMultiplier);
  }, [moduleConfig.analysisControls.groups, controlSelections, defaultMultiplier]);

  // 验证 + 标准化 + 评分
  const scoredReport = useMemo(() => {
    const definitions = subscoreDefinitions ?? defaultSubscoreDefinitions;

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

    // 2. 标准化为 ReportJsonData
    const { metadata } = data;
    const normalizedReport: ReportJsonData = {
      schemaVersion: 'report_schema_v5_0_ratings',
      reportId: `report-${Date.now()}`,
      reportVersion: metadata.templateVersion,
      generatedAt: new Date().toISOString(),
      summary: {
        title: parsed.data.summary.title || `${getGoalLabel(metadata.evaluationGoal)}概览`,
        overview: parsed.data.summary.overview,
      },
      dashboard: {
        totalScore: 0,
        grade: 'D',
        subscores: parsed.data.subscores.map((subscore) => ({
          id: subscore.id,
          label: definitions.find(d => d.id === subscore.id)?.label ?? subscore.id,
          grade: subscore.grade,
          score: 0,
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
      groups: parsed.data.groups?.map((group, groupIndex) => ({
        id: group.id?.trim() || `group-${groupIndex + 1}`,
        title: group.title,
        sections: group.sections.map((section, sectionIndex) => ({
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
        sectionCount: parsed.data.groups?.reduce((acc, g) => acc + g.sections.length, 0) ?? 0,
      },
    };

    // 兼容旧格式：如果没有 groups，使用 sections
    if (normalizedReport.groups.length === 0 && parsed.data.sections) {
      normalizedReport.sections = parsed.data.sections.map((section, index) => ({
        id: `section-root-${index + 1}`,
        title: section.title,
        body: section.body,
      }));
      normalizedReport.diagnostics.sectionCount = normalizedReport.sections.length;
    } else {
      normalizedReport.sections = normalizedReport.groups.flatMap(g => g.sections);
    }

    // 3. 提取 grades 和 rationales
    const grades: Record<string, ReportRating> = {};
    const rationales: Record<string, string> = {};

    for (const subscore of normalizedReport.dashboard.subscores) {
      grades[subscore.id] = subscore.grade;
      rationales[subscore.id] = subscore.rationale;
    }

    // 4. 调用评分计算
    const scoreResult = scoring.calculate({
      grades,
      rationales,
      definitions,
      multipliers,
      defaultMultiplier,
    });

    // 5. 合并计算结果到报告数据
    return {
      ...normalizedReport,
      dashboard: {
        ...normalizedReport.dashboard,
        totalScore: scoreResult.totalScore,
        grade: scoreResult.grade,
        subscores: scoreResult.subscores,
      },
    };
  }, [data, subscoreDefinitions, multipliers, defaultMultiplier]);

  return (
    <ReportJsonView
      report={scoredReport}
      onStartNew={onStartNew}
      onBackToEdit={onBackToEdit}
    />
  );
}
