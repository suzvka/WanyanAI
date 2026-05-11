/**
 * 高考作文评分计算逻辑
 * 
 * 满分60分，基于高考作文评分标准
 */

import type { ReportRating } from '@/config/reportScoring';
import { reportRatingValues } from '@/config/reportScoring';
import type { SubscoreDefinition } from './subscores';
import { gaokaoSubscoreDefinitions, gaokaoSubscoreWeights, gaokaoSubscoreIds } from './subscores';
import type { GaokaoSubscoreId } from './subscores';

// === 评分常量 ===

/** 满分（高考作文标准） */
export const GAOKAO_MAX_SCORE = 60;

/** 维度数量 */
export const GAOKAO_DIMENSION_COUNT = 6;

/** 基准分（中性状态下S级的分数 = 60 / 6 = 10） */
export const GAOKAO_BASE_SCORE = 10;

/** 最高基础分（用于归一化） */
export const GAOKAO_MAX_BASE_SCORE = 5;

/** 中性乘子（幂次映射的锚点） */
export const GAOKAO_NEUTRAL_MULTIPLIER = 1;

/**
 * 评级基础分
 * 
 * 设计目标（中性乘子下）：
 * - S → 10分 (ratio=1.0)
 * - A → 9分  (ratio=0.9)
 * - B → 8分  (ratio=0.8)
 * - C → 7分  (ratio=0.7)
 * - D → 6分  (ratio=0.6)
 * 
 * 公式：分数 = (baseScore / GAOKAO_MAX_BASE_SCORE) × GAOKAO_BASE_SCORE
 */
export const ratingBaseScores: Record<ReportRating, number> = {
  S: 5,   // 5/5 × 10 = 10分
  A: 4.5, // 4.5/5 × 10 = 9分
  B: 4,   // 4/5 × 10 = 8分
  C: 3.5, // 3.5/5 × 10 = 7分
  D: 3,   // 3/5 × 10 = 6分
};

// === 类型定义 ===

/** 子维度乘子配置 */
export type SubscoreMultipliers = Record<string, number>;

/** 计算后的子维度数据 */
export type CalculatedSubscore = {
  id: string;
  label: string;
  grade: ReportRating;
  score: number;
  maxScore: number;
  rationale: string;
};

/** 评分计算结果 */
export type ScoreResult = {
  totalScore: number;
  maxScore: number;
  grade: ReportRating;
  subscores: CalculatedSubscore[];
};

/** 评分计算选项 */
export type ScoringOptions = {
  /** 维度ID -> 评级 */
  grades: Record<string, ReportRating>;
  /** 维度ID -> 理由 */
  rationales: Record<string, string>;
  /** 维度定义（默认使用高考作文6个维度） */
  definitions?: SubscoreDefinition[];
  /** 自定义乘子 */
  multipliers?: SubscoreMultipliers;
  /** 默认乘子（默认1-中性值） */
  defaultMultiplier?: number;
};

// === 评分函数 ===

/**
 * 计算子维度分数（幂次映射）
 * 
 * 公式：分数 = (基础分 / 最高基础分)^(中性乘子/实际乘子) × 基准分
 * 
 * @param grade - 评级 (S/A/B/C/D)
 * @param multiplier - 乘子（默认1-中性值）
 * @returns 分数
 */
export function calcSubscore(grade: ReportRating, multiplier?: number): number {
  const baseScore = ratingBaseScores[grade];
  const mult = multiplier ?? GAOKAO_NEUTRAL_MULTIPLIER;
  
  // 归一化：S=1.0, A=0.9, B=0.8, C=0.7, D=0.6
  const ratio = baseScore / GAOKAO_MAX_BASE_SCORE;
  
  // 幂次：乘子越大，exponent越小，低分被压缩得越厉害
  const exponent = GAOKAO_NEUTRAL_MULTIPLIER / mult;
  
  // 最终分数
  return Math.pow(ratio, exponent) * GAOKAO_BASE_SCORE;
}

/**
 * 根据单个维度分数推导评级
 * 
 * 阈值设计：在相邻等级分数的中间点
 * - S: >= 9.5分 (ratio >= 0.95)
 * - A: >= 8.5分 (ratio >= 0.85)
 * - B: >= 7.5分 (ratio >= 0.75)
 * - C: >= 6.5分 (ratio >= 0.65)
 * - D: < 6.5分 (ratio < 0.65)
 * 
 * @param score - 维度分数
 * @param maxScore - 维度满分
 * @returns 推导出的评级
 */
export function deriveGradeFromScore(score: number, maxScore: number = GAOKAO_BASE_SCORE): ReportRating {
  const ratio = maxScore > 0 ? score / maxScore : 0;
  
  if (ratio >= 0.95) return 'S';
  if (ratio >= 0.85) return 'A';
  if (ratio >= 0.75) return 'B';
  if (ratio >= 0.65) return 'C';
  return 'D';
}

/**
 * 根据总分推导评级
 * 
 * 阈值与 deriveGradeFromScore 一致，在相邻等级分数的中间点
 * 
 * @param totalScore - 总分
 * @param maxScore - 最高分
 * @returns 评级
 */
export function deriveGrade(totalScore: number, maxScore: number): ReportRating {
  const ratio = maxScore > 0 ? totalScore / maxScore : 0;

  if (ratio >= 0.9) return 'S';
  if (ratio >= 0.8) return 'A';
  if (ratio >= 0.7) return 'B';
  if (ratio >= 0.6) return 'C';
  return 'D';
}

/**
 * 获取维度满分（基于权重）
 * 
 * @param dimensionId - 维度ID
 * @returns 该维度的满分
 */
export function getDimensionMaxScore(dimensionId: string): number {
  const weight = gaokaoSubscoreWeights[dimensionId as GaokaoSubscoreId] ?? (1 / GAOKAO_DIMENSION_COUNT);
  return GAOKAO_MAX_SCORE * weight;
}

/**
 * 完整评分计算
 * 
 * @param options - 计算选项
 * @returns 评分结果
 */
export function calculate(options: ScoringOptions): ScoreResult {
  const {
    grades,
    rationales,
    definitions = gaokaoSubscoreDefinitions,
    multipliers = {},
    defaultMultiplier = GAOKAO_NEUTRAL_MULTIPLIER,
  } = options;

  // 计算每个子维度的分数
  const subscores: CalculatedSubscore[] = definitions.map((def) => {
    const inputGrade = grades[def.id];
    const rationale = rationales[def.id] ?? '';
    const multiplier = multipliers[def.id] ?? defaultMultiplier;
    const maxScore = getDimensionMaxScore(def.id);

    // 缺失维度的分数为0，评级为D
    if (!inputGrade) {
      return {
        id: def.id,
        label: def.label,
        grade: 'D' as ReportRating,
        score: 0,
        maxScore,
        rationale,
      };
    }

    // 计算分数（中性乘子时，S级分数 = GAOKAO_BASE_SCORE = 10）
    const normalizedScore = calcSubscore(inputGrade, multiplier);
    
    // 按权重缩放：分数 = 基础分 × 权重 × 维度数量
    // 例如：审题立意权重30%，S级得分 = 10 × 0.30 × 6 = 18分
    const weight = gaokaoSubscoreWeights[def.id as GaokaoSubscoreId] ?? (1 / GAOKAO_DIMENSION_COUNT);
    const score = normalizedScore * weight * GAOKAO_DIMENSION_COUNT;

    return {
      id: def.id,
      label: def.label,
      grade: inputGrade,
      score: Math.round(score * 10) / 10, // 保留1位小数
      maxScore: Math.round(maxScore * 10) / 10,
      rationale,
    };
  });

  // 计算总分
  const totalScore = subscores.reduce((total, item) => total + item.score, 0);
  const roundedTotalScore = Math.round(totalScore * 10) / 10;

  // 根据总分推导最终评级
  let grade = deriveGrade(roundedTotalScore, GAOKAO_MAX_SCORE);

  // 保底机制：总分评级不能低于中位数维度的评级
  const sortedGrades = subscores
    .map((s) => reportRatingValues.indexOf(s.grade))
    .sort((a, b) => a - b);
  const medianIndex = Math.floor(sortedGrades.length / 2);
  const medianGradeIndex = sortedGrades[medianIndex];
  const currentGradeIndex = reportRatingValues.indexOf(grade);
  
  if (currentGradeIndex > medianGradeIndex) {
    grade = reportRatingValues[medianGradeIndex];
  }

  return {
    totalScore: roundedTotalScore,
    maxScore: GAOKAO_MAX_SCORE,
    grade,
    subscores,
  };
}

/**
 * 评分工具对象
 */
export const scoring = {
  calcSubscore,
  deriveGrade,
  deriveGradeFromScore,
  getDimensionMaxScore,
  calculate,
};
