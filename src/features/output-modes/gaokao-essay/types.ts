/**
 * 高考作文评分报告数据类型
 * 
 * 定义高考作文评分报告特有的数据结构
 */

import type { ReportRating } from '@/config/reportScoring';
import type { AnalysisReportMetadata, ReportScoringContext } from '@/types/analysis';

// === 报告数据类型 ===

/** 报告摘要 */
export type GaokaoSummary = {
  title: string;
  overview: string;
};

/** 报告子维度 */
export type GaokaoSubscore = {
  id: string;
  label: string;
  grade: ReportRating;
  score: number;
  maxScore: number;
  rationale: string;
};

/** 报告仪表盘 */
export type GaokaoDashboard = {
  totalScore: number;
  maxScore: number;
  grade: ReportRating;
  subscores: GaokaoSubscore[];
};

/** 报告结论 */
export type GaokaoConclusion = {
  rationale: string;
};

/** 报告章节 */
export type GaokaoSection = {
  id: string;
  title: string;
  body: string;
  groupId?: string;
  groupTitle?: string;
};

/** 报告章节组 */
export type GaokaoSectionGroup = {
  id: string;
  title: string;
  sections: GaokaoSection[];
};

/** 报告元数据 */
export type GaokaoMeta = {
  provider: string;
  model: string;
};

/** 报告诊断信息 */
export type GaokaoDiagnostics = {
  normalizationMode: 'paragraph-sections';
  sectionCount: number;
};

/** 高考作文评分报告数据格式 */
export type GaokaoEssayData = {
  schemaVersion: string;
  reportId: string;
  reportVersion: string;
  generatedAt: string;
  summary: GaokaoSummary;
  dashboard: GaokaoDashboard;
  conclusion: GaokaoConclusion;
  meta: GaokaoMeta;
  groups: GaokaoSectionGroup[];
  sections: GaokaoSection[];
  diagnostics: GaokaoDiagnostics;
};

// === 原始输入类型 ===

/** 渲染器接收的原始输入 */
export type GaokaoEssayRawInput = {
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
 * 验证数据是否为有效的 GaokaoEssayData
 */
export function isGaokaoEssayData(data: unknown): data is GaokaoEssayData {
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
