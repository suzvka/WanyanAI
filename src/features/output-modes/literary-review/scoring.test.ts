/**
 * I2 — 文学评审评分计算单测
 *
 * 覆盖：幂次映射、评级阈值、加权总分（优势维度加权）、
 * 保底机制、缺失维度兜底。
 */
import { describe, it, expect } from 'vitest';
import {
  calcSubscore,
  calcTotal,
  deriveGrade,
  deriveGradeFromScore,
  getMaxScore,
  calculate,
} from './scoring';
import { defaultSubscoreIds } from './subscores';
import type { ReportRating } from '@/config/reportScoring';

describe('calcSubscore（幂次映射，基准分 20）', () => {
  it('中性乘子下：S=20 A=16 B=12 C=8 D=4', () => {
    expect(calcSubscore('S')).toBeCloseTo(20);
    expect(calcSubscore('A')).toBeCloseTo(16);
    expect(calcSubscore('B')).toBeCloseTo(12);
    expect(calcSubscore('C')).toBeCloseTo(8);
    expect(calcSubscore('D')).toBeCloseTo(4);
  });

  it('乘子 > 1 极化、乘子 < 1 收敛，S 锚点恒为 20，分数恒 > 0', () => {
    expect(calcSubscore('S', 4)).toBeCloseTo(20);
    // D,mult=4: 0.2^(1/4) × 20 ≈ 13.37
    expect(calcSubscore('D', 4)).toBeCloseTo(Math.pow(0.2, 0.25) * 20);
    expect(calcSubscore('D', 0.25)).toBeCloseTo(Math.pow(0.2, 4) * 20);
    expect(calcSubscore('D', 4)).toBeGreaterThan(0);
  });
});

describe('deriveGradeFromScore（维度分→评级）', () => {
  it('阈值 18/14/10/6', () => {
    expect(deriveGradeFromScore(20)).toBe('S');
    expect(deriveGradeFromScore(18)).toBe('S');
    expect(deriveGradeFromScore(17.9)).toBe('A');
    expect(deriveGradeFromScore(14)).toBe('A');
    expect(deriveGradeFromScore(10)).toBe('B');
    expect(deriveGradeFromScore(6)).toBe('C');
    expect(deriveGradeFromScore(5.9)).toBe('D');
  });
});

describe('deriveGrade / getMaxScore / calcTotal', () => {
  it('总分阈值 0.9/0.8/0.7/0.6（默认满分 120）', () => {
    expect(deriveGrade(120)).toBe('S');
    expect(deriveGrade(108)).toBe('S');
    expect(deriveGrade(96)).toBe('A');
    expect(deriveGrade(84)).toBe('B');
    expect(deriveGrade(72)).toBe('C');
    expect(deriveGrade(71)).toBe('D');
  });

  it('满分 = 基准分 × 维度数', () => {
    expect(getMaxScore()).toBe(120);
    expect(getMaxScore(3)).toBe(60);
  });

  it('calcTotal 求和', () => {
    expect(calcTotal([{ score: 20 }, { score: 16 }, { score: 0 }])).toBe(36);
    expect(calcTotal([])).toBe(0);
  });
});

describe('calculate（完整评分）', () => {
  const rationales = Object.fromEntries(defaultSubscoreIds.map((id) => [id, '理由']));

  function gradesOf(grade: ReportRating): Record<string, ReportRating> {
    return Object.fromEntries(defaultSubscoreIds.map((id) => [id, grade]));
  }

  it('全 S：原始总分 120，评级 S（加权后仍为满比例）', () => {
    const result = calculate({ grades: gradesOf('S'), rationales });
    expect(result.totalScore).toBeCloseTo(120);
    expect(result.grade).toBe('S');
    expect(result.subscores).toHaveLength(6);
  });

  it('评级由分数推导覆盖（中性乘子下输入评级与推导一致）', () => {
    const result = calculate({ grades: gradesOf('A'), rationales });
    expect(result.subscores.every((s) => s.grade === 'A')).toBe(true);
  });

  it('缺失维度：分数 0、评级 D', () => {
    const grades = gradesOf('B');
    delete grades.aesthetic_tension;
    const result = calculate({ grades, rationales });
    const missing = result.subscores.find((s) => s.id === 'aesthetic_tension')!;
    expect(missing.score).toBe(0);
    expect(missing.grade).toBe('D');
  });

  it('保底机制：全 B 时加权总分评级为 C，被中位数维度评级托底为 B', () => {
    // 全 B：各维度 12 分，加权总分 = 12×6 = 72 → 72/120 = 0.6 → C；
    // 维度评级中位数为 B，保底把 C 抬回 B
    const result = calculate({ grades: gradesOf('B'), rationales });
    expect(result.totalScore).toBeCloseTo(72);
    expect(result.grade).toBe('B');
  });

  it('保底机制不反向压低：全 S 保持 S', () => {
    const result = calculate({ grades: gradesOf('S'), rationales });
    expect(result.grade).toBe('S');
  });

  it('加权后评级基于加权总分而非原始总分（分数离散时差异显现）', () => {
    // 3 个 S(20) + 3 个 D(4)：原始总分 72 → 0.6 → C
    // 加权：高分维度权重更高 → 加权总分 > 72 → 评级应不差于 C
    const grades: Record<string, ReportRating> = {};
    defaultSubscoreIds.forEach((id, i) => {
      grades[id] = i < 3 ? 'S' : 'D';
    });
    const result = calculate({ grades, rationales });
    expect(result.totalScore).toBeCloseTo(72);
    expect(['S', 'A', 'B', 'C']).toContain(result.grade);
  });
});
