/**
 * 评分计算逻辑
 * 
 * 封装所有评分相关的计算逻辑，提供简洁的工具函数接口
 */

import type { ReportRating } from '@/config/reportScoring';
import {
  reportRatingValues,
  reportRatingBaseScores,
  reportNeutralMultiplier,
  reportBaseScore,
  reportMaxBaseScore,
} from '@/config/reportScoring';
import type { SubscoreDefinition } from './subscores';
import { defaultSubscoreDefinitions, defaultSubscoreIds } from './subscores';

/** 子维度乘子配置 */
export type SubscoreMultipliers = Record<string, number>;

/** 计算后的子维度数据 */
export type CalculatedSubscore = {
  id: string;
  label: string;
  grade: ReportRating;
  score: number;
  rationale: string;
};

/** 评分计算结果 */
export type ScoreResult = {
  totalScore: number;
  grade: ReportRating;
  subscores: CalculatedSubscore[];
};

/** 评分计算选项 */
export type ScoringOptions = {
  /** 维度ID -> 评级 */
  grades: Record<string, ReportRating>;
  /** 维度ID -> 理由 */
  rationales: Record<string, string>;
  /** 维度定义（默认使用6个标准维度） */
  definitions?: SubscoreDefinition[];
  /** 自定义乘子 */
  multipliers?: SubscoreMultipliers;
  /** 默认乘子（默认1-中性值） */
  defaultMultiplier?: number;
};

/**
 * 计算子维度分数（幂次映射）
 * 
 * 公式：分数 = (基础分 / 最高基础分)^(中性乘子/实际乘子) × 基准分
 * 
 * 特性：
 * - 乘子越大 → 低分越低 → 极化效应
 * - 乘子越小 → 分数收敛 → 压缩效应
 * - S级始终等于基准分（锚点不变）
 * - 分数永远 > 0
 * 
 * @param grade - 评级 (S/A/B/C/D)
 * @param multiplier - 乘子（默认1-中性值）
 * @returns 分数
 */
export function calcSubscore(grade: ReportRating, multiplier?: number): number {
  const baseScore = reportRatingBaseScores[grade];
  const mult = multiplier ?? reportNeutralMultiplier;
  
  // 归一化：S=1, A=0.8, B=0.6, C=0.4, D=0.2
  const ratio = baseScore / reportMaxBaseScore;
  
  // 幂次：乘子越大，exponent越小，低分被压缩得越厉害
  const exponent = reportNeutralMultiplier / mult;
  
  // 最终分数
  return Math.pow(ratio, exponent) * reportBaseScore;
}

/**
 * 根据单个维度分数推导评级
 * 
 * 阈值基于中性状态下的标准分数区间中点：
 * - S = 20, A = 16, B = 12, C = 8, D = 4
 * 
 * @param score - 维度分数
 * @returns 推导出的评级
 */
export function deriveGradeFromScore(score: number): ReportRating {
  // 阈值取区间中点，确保公平性
  if (score >= 18) return 'S';
  if (score >= 14) return 'A';
  if (score >= 10) return 'B';
  if (score >= 6) return 'C';
  return 'D';
}

/**
 * 计算总分
 * 
 * @param subscores - 子维度数组
 * @returns 总分
 */
export function calcTotal(subscores: Array<{ score: number }>): number {
  return subscores.reduce((total, item) => total + item.score, 0);
}

/**
 * 根据总分推导评级
 * 
 * @param totalScore - 总分
 * @param maxScore - 最高分（可选，默认使用标准最大分）
 * @returns 评级
 */
export function deriveGrade(totalScore: number, maxScore?: number): ReportRating {
  const maximum = maxScore ?? getMaxScore();
  const ratio = maximum > 0 ? totalScore / maximum : 0;

  if (ratio >= 0.9) return 'S';
  if (ratio >= 0.8) return 'A';
  if (ratio >= 0.7) return 'B';
  if (ratio >= 0.6) return 'C';
  return 'D';
}

/**
 * 获取最大分数
 * 
 * @param dimensionCount - 维度数量（默认使用标准维度数量）
 * @returns 最大分数（S级分数恒定，与乘子无关）
 */
export function getMaxScore(dimensionCount?: number): number {
  const count = dimensionCount ?? defaultSubscoreIds.length;
  return reportBaseScore * count;
}

/**
 * 计算加权总分（硬编码6个维度的中等权重配置）
 * 
 * 权重配置（中等强度，从高到低）：
 * - 第1名（最高分）：0.25
 * - 第2名：0.22
 * - 第3名：0.19
 * - 第4名：0.16
 * - 第5名：0.13
 * - 第6名（最低分）：0.10
 * 
 * 最后将加权总分缩放回原总分范围，保持用户体验一致。
 * 
 * @param subscores - 子维度数组
 * @param originalTotal - 原始总分（用于缩放回原范围）
 * @param maxScore - 最大分数
 * @returns 加权后的总分
 */
function calculateWeightedTotal(
  subscores: CalculatedSubscore[],
  originalTotal: number,
  maxScore: number
): number {
  // 1. 硬编码6个维度的权重（中等强度配置）
  const rawWeights = [0.25, 0.22, 0.19, 0.16, 0.13, 0.10];
  
  // 2. 归一化权重到总和为1
  const totalWeight = rawWeights.reduce((a, b) => a + b, 0);
  const weights = rawWeights.map(w => w / totalWeight);
  
  // 3. 将子维度按分数从高到低排序
  const sortedSubscores = [...subscores].sort((a, b) => b.score - a.score);
  
  // 4. 计算加权总分
  let weightedTotal = 0;
  for (let i = 0; i < sortedSubscores.length && i < weights.length; i++) {
    weightedTotal += sortedSubscores[i].score * weights[i];
  }
  
  // 5. 缩放回原总分范围，保持用户体验一致
  // 加权总分范围 = [0, 20]（单个维度范围）
  // 目标总分范围 = [0, maxScore]（原始总分范围）
  const scaleFactor = maxScore / reportBaseScore;
  const scaledTotal = weightedTotal * scaleFactor;
  
  return scaledTotal;
}

/**
 * 完整评分计算
 * 
 * 根据提供的评级和理由，计算完整的评分结果
 * - 遍历所有维度定义
 * - 对每个维度计算分数
 * - 根据分数重新推导评级（覆盖模型输出的评级）
 * - 缺失维度的分数填0
 * - 计算原始总分
 * - 计算加权总分（优势维度权重更高）
 * - 根据加权总分推导最终评级
 * 
 * @param options - 计算选项
 * @returns 评分结果
 */
export function calculate(options: ScoringOptions): ScoreResult {
  const {
    grades,
    rationales,
    definitions = defaultSubscoreDefinitions,
    multipliers = {},
    defaultMultiplier = reportNeutralMultiplier,
  } = options;

  // 计算每个子维度的分数，并根据分数重新推导评级
  const subscores: CalculatedSubscore[] = definitions.map((def) => {
    const inputGrade = grades[def.id];
    const rationale = rationales[def.id] ?? '';
    const multiplier = multipliers[def.id] ?? defaultMultiplier;

    // 缺失维度的分数为0，评级为D
    if (!inputGrade) {
      return {
        id: def.id,
        label: def.label,
        grade: 'D' as ReportRating,
        score: 0,
        rationale,
      };
    }

    // 计算分数（使用幂次映射）
    const score = calcSubscore(inputGrade, multiplier);
    
    // 根据分数重新推导评级（覆盖模型输出的评级）
    const derivedGrade = deriveGradeFromScore(score);

    return {
      id: def.id,
      label: def.label,
      grade: derivedGrade,
      score,
      rationale,
    };
  });

  // 计算原始总分
  const originalTotal = calcTotal(subscores);

  // 计算最大分（S级分数恒定=基准分，与乘子无关）
  const maxScore = definitions.length * reportBaseScore;

  // 计算加权总分（优势维度权重更高）
  const weightedTotal = calculateWeightedTotal(subscores, originalTotal, maxScore);

  // 根据加权总分推导最终评级
  let grade = deriveGrade(weightedTotal, maxScore);

  // 保底机制：总分评级不能低于中位数维度的评级
  // 这避免了"多数子维度高评价但总分低评价"的反直觉情况
  const sortedGrades = subscores
    .map((s) => reportRatingValues.indexOf(s.grade))
    .sort((a, b) => a - b);
  const medianIndex = Math.floor(sortedGrades.length / 2);
  const medianGradeIndex = sortedGrades[medianIndex]; // 取中间偏好的那个
  const currentGradeIndex = reportRatingValues.indexOf(grade);
  
  if (currentGradeIndex > medianGradeIndex) {
    grade = reportRatingValues[medianGradeIndex];
  }

  return {
    totalScore: originalTotal,  // 显示给用户的仍为原始总分
    grade,  // 但评级基于加权总分（含保底逻辑）
    subscores,
  };
}

/**
 * 评分工具对象
 * 
 * 提供统一的评分计算接口
 */
export const scoring = {
  calcSubscore,
  calcTotal,
  deriveGrade,
  deriveGradeFromScore,
  getMaxScore,
  calculate,
};
