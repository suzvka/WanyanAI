/**
 * 文学作品评审输出模式的数据类型
 *
 * 定义文学作品评审特有的数据结构，不依赖通用类型
 */

import type { ReportRating } from '@/config/reportScoring';
import type { AnalysisReportMetadata, ReportScoringContext } from '@/types/analysis';

// === 报告数据类型 ===

/** 报告摘要 */
export type LiteraryReviewSummary = {
  title: string;
  overview: string;
};

/** 报告子维度 */
export type LiteraryReviewSubscore = {
  id: string;
  label: string;
  grade: ReportRating;
  score: number;
  rationale: string;
};

/** 报告仪表盘 */
export type LiteraryReviewDashboard = {
  totalScore: number;
  grade: ReportRating;
  subscores: LiteraryReviewSubscore[];
};

/** 报告结论 */
export type LiteraryReviewConclusion = {
  rationale: string;
};

/** 报告段落（扁平结构，按 sectionTitle 分组渲染） */
export type LiteraryReviewSection = {
  /** 章节标题（如"创作背景"、"主题分析"） */
  sectionTitle: string;
  /** 段落标题（如"历史背景"、"核心主题"） */
  paragraphTitle: string;
  /** 段落内容 */
  body: string;
};

/** 报告元数据 */
export type LiteraryReviewMeta = {
  provider: string;
  model: string;
};

/** 报告诊断信息 */
export type LiteraryReviewDiagnostics = {
  normalizationMode: 'paragraph-sections';
  sectionCount: number;
};

/** 文学作品评审数据格式 */
export type LiteraryReviewData = {
  schemaVersion: string;
  reportId: string;
  reportVersion: string;
  generatedAt: string;
  summary: LiteraryReviewSummary;
  dashboard: LiteraryReviewDashboard;
  conclusion: LiteraryReviewConclusion;
  meta: LiteraryReviewMeta;
  sections: LiteraryReviewSection[];
  diagnostics: LiteraryReviewDiagnostics;
};

// === 原始输入类型 ===

/** 渲染器接收的原始输入 */
export type LiteraryReviewRawInput = {
  /** 报告唯一 ID */
  reportId: string;
  /** 报告生成时间 */
  createdAt: string;
  /** 模型返回的原始 JSON 数据 */
  rawJson: unknown;
  /** 分析元数据 */
  metadata: AnalysisReportMetadata;
  /** 评分上下文快照 */
  scoringContext: ReportScoringContext;
};

/**
 * 验证数据是否为有效的 LiteraryReviewData
 */
export function isLiteraryReviewData(data: unknown): data is LiteraryReviewData {
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
