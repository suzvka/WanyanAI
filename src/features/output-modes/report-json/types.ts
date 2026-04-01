/**
 * report-json 输出模式的数据类型
 * 
 * 定义 report-json 特有的数据结构，不依赖通用类型
 */

import type { ReportRating } from '@/config/reportScoring';

// === 报告数据类型 ===

/** 报告摘要 */
export type ReportSummary = {
  title: string;
  overview: string;
};

/** 报告子维度 */
export type ReportSubscore = {
  id: string;
  label: string;
  grade: ReportRating;
  score: number;
  rationale: string;
};

/** 报告仪表盘 */
export type ReportDashboard = {
  totalScore: number;
  grade: ReportRating;
  subscores: ReportSubscore[];
};

/** 报告结论 */
export type ReportConclusion = {
  rationale: string;
};

/** 报告章节 */
export type ReportSection = {
  id: string;
  title: string;
  body: string;
  groupId?: string;
  groupTitle?: string;
};

/** 报告章节组 */
export type ReportSectionGroup = {
  id: string;
  title: string;
  sections: ReportSection[];
};

/** 报告元数据 */
export type ReportMeta = {
  frameworkVersion: string;
  scoringPolicyVersion: string;
  conclusionPolicyVersion: string;
  provider: string;
  model: string;
};

/** 报告诊断信息 */
export type ReportDiagnostics = {
  normalizationMode: 'paragraph-sections';
  sectionCount: number;
};

/** report-json 数据格式 */
export type ReportJsonData = {
  schemaVersion: string;
  reportId: string;
  reportVersion: string;
  generatedAt: string;
  summary: ReportSummary;
  dashboard: ReportDashboard;
  conclusion: ReportConclusion;
  meta: ReportMeta;
  groups: ReportSectionGroup[];
  sections: ReportSection[];
  diagnostics: ReportDiagnostics;
};

// === 原始输入类型 ===

/** 渲染器接收的原始输入 */
export type ReportJsonRawInput = {
  /** 模型返回的原始 JSON 数据 */
  rawJson: unknown;
  /** 分析元数据 */
  metadata: {
    /** 模型名称 */
    model: string;
    /** API 基础 URL */
    baseUrl: string;
    /** 提示词模板版本 */
    templateVersion: string;
    /** 评分策略版本 */
    scoringPolicyVersion: string;
    /** 结论策略版本 */
    conclusionPolicyVersion: string;
    /** 评价目标 */
    evaluationGoal: string;
  };
};

/**
 * 验证数据是否为有效的 ReportJsonData
 */
export function isReportJsonData(data: unknown): data is ReportJsonData {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const obj = data as Record<string, unknown>;

  return (
    typeof obj.reportId === 'string' &&
    typeof obj.generatedAt === 'string' &&
    obj.summary !== undefined &&
    obj.dashboard !== undefined &&
    obj.conclusion !== undefined
  );
}
