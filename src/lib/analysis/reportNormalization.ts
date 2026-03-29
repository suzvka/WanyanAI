import { evaluationGoalLabels } from '@/config/evaluationDimensions';
import {
    calculateMaximumReportScore,
    reportRatingBaseScores,
    reportWeightMultiplier,
} from '@/config/reportScoring';
import { createAppError } from '@/types/errors';
import type {
  ModelMinimalReport,
  ModelMinimalSectionGroup,
  ModelMinimalSection,
  ModelMinimalSubscore,
  ModelSubscoreId,
  PromptTemplateResource,
} from '@/types/analysis';
import type {
  AnalysisReport,
  ReportSection,
  ReportSectionGroup,
  ReportSubscore,
} from '@/types/report';
import { modelMinimalReportSchema } from './modelOutputSchema';

const modelSubscoreDefinitions: Record<ModelSubscoreId, { label: string }> = {
  language_expression: { label: '语言表现力' },
  structural_logic: { label: '结构逻辑' },
  human_depth: { label: '人文深度' },
  inner_complexity: { label: '内在复杂性' },
  semantic_openness: { label: '语义开放性' },
  empathic_effectiveness: { label: '共情效能' },
};

const reportSchemaVersion = 'report_schema_v5_0_ratings';

function calculateSubscoreScore(grade: keyof typeof reportRatingBaseScores) {
    return reportRatingBaseScores[grade] * reportWeightMultiplier;
}

function calculateTotalScore(subscores: ReportSubscore[]) {
    return subscores.reduce((total, item) => total + item.score, 0);
}

function deriveGrade(totalScore: number) {
    const maximumScore = calculateMaximumReportScore();
    const ratio = maximumScore > 0 ? totalScore / maximumScore : 0;

    if (ratio >= 0.9) return 'S';
    if (ratio >= 0.8) return 'A';
    if (ratio >= 0.7) return 'B';
    if (ratio >= 0.6) return 'C';
    return 'D';
}

function getProviderHost(baseUrl: string) {
  try {
    return new URL(baseUrl).host;
  } catch {
    return 'remote-openai-compatible';
  }
}

function normalizeSubscores(subscores: ModelMinimalSubscore[]): ReportSubscore[] {
  const subscoreMap = new Map(subscores.map((subscore) => [subscore.id, subscore]));

  return Object.entries(modelSubscoreDefinitions).map(([id, definition]) => {
    const subscore = subscoreMap.get(id as ModelSubscoreId);

    if (!subscore) {
      throw createAppError({
        code: 'report_schema_invalid',
        message: `远程分析缺少子维度：${id}`,
        retryable: true,
      });
    }

    return {
      id: subscore.id,
      label: definition.label,
      grade: subscore.grade,
      score: calculateSubscoreScore(subscore.grade),
      rationale: subscore.rationale,
    };
  });
}

function normalizeSections(
  sections: ModelMinimalSection[],
  groupId?: string,
  groupTitle?: string,
): ReportSection[] {
  return sections.map((section, index) => ({
    id: `section-${groupId || 'root'}-${index + 1}`,
    title: section.title,
    body: section.body,
    groupId,
    groupTitle,
  }));
}

function normalizeSectionGroups(groups: ModelMinimalSectionGroup[] | undefined): ReportSectionGroup[] {
  if (!groups || groups.length === 0) {
    return [];
  }

  return groups.map((group, index) => {
    const groupId = group.id?.trim() || `group-${index + 1}`;

    return {
      id: groupId,
      title: group.title,
      sections: normalizeSections(group.sections, groupId, group.title),
    };
  });
}

function getSummaryTitle(report: ModelMinimalReport, template: PromptTemplateResource) {
  return report.summary.title || `${evaluationGoalLabels[template.evaluationGoal]}概览`;
}

export function normalizeModelMinimalReport(
  payload: unknown,
  template: PromptTemplateResource,
  baseUrl: string,
  model: string,
): AnalysisReport {
  const parsed = modelMinimalReportSchema.safeParse(payload);

  if (!parsed.success) {
    throw createAppError({
      code: 'report_schema_invalid',
      message: parsed.error.issues[0]?.message || '远程分析返回的报告结构不合法',
      retryable: true,
    });
  }

  const data = parsed.data;
  const groups = normalizeSectionGroups(data.groups);
  
  // 优先使用 groups，如果 groups 为空则使用 sections（兼容旧格式）
  const sections = groups.length > 0
    ? groups.flatMap((group) => group.sections)
    : data.sections 
      ? normalizeSections(data.sections)
      : [];
      
  const subscores = normalizeSubscores(data.subscores);
  const totalScore = calculateTotalScore(subscores);

  return {
    schemaVersion: reportSchemaVersion,
    reportId: `report-${Date.now()}`,
    reportVersion: template.version,
    generatedAt: new Date().toISOString(),
    summary: {
      title: getSummaryTitle(data, template),
      overview: data.summary.overview,
    },
    dashboard: {
      totalScore,
      grade: deriveGrade(totalScore),
      subscores,
    },
    conclusion: {
      rationale: data.conclusion.rationale,
    },
    meta: {
      frameworkVersion: template.version,
      scoringPolicyVersion: template.policyMeta.scoringPolicyVersion,
      conclusionPolicyVersion: template.policyMeta.conclusionPolicyVersion,
      provider: getProviderHost(baseUrl),
      model,
    },
    groups,
    sections,
    diagnostics: {
      normalizationMode: 'paragraph-sections',
      sectionCount: sections.length,
    },
  };
}
