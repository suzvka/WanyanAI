/**
 * I2 — 高考作文评分计算单测
 *
 * 覆盖：幂次映射（中性/非中性乘子）、评级映射阈值、权重缩放、
 * 缺失维度兜底、总分评级保底机制。
 */
import { describe, it, expect } from 'vitest';
import {
  calcSubscore,
  deriveGrade,
  deriveGradeFromScore,
  getDimensionMaxScore,
  calculate,
  GAOKAO_MAX_SCORE,
  GAOKAO_BASE_SCORE,
} from './scoring';
import { gaokaoSubscoreIds } from './subscores';
import type { ReportRating } from '@/config/reportScoring';

describe('calcSubscore（幂次映射）', () => {
  it('中性乘子下严格对应设计分：S=10 A=9 B=8 C=7 D=6', () => {
    expect(calcSubscore('S')).toBeCloseTo(10);
    expect(calcSubscore('A')).toBeCloseTo(9);
    expect(calcSubscore('B')).toBeCloseTo(8);
    expect(calcSubscore('C')).toBeCloseTo(7);
    expect(calcSubscore('D')).toBeCloseTo(6);
  });

  it('乘子 > 1：低分被压缩上抬（极化），S 锚点不变', () => {
    expect(calcSubscore('S', 2)).toBeCloseTo(10);
    // D: 0.6^(1/2) × 10 ≈ 7.746
    expect(calcSubscore('D', 2)).toBeCloseTo(Math.sqrt(0.6) * GAOKAO_BASE_SCORE);
    expect(calcSubscore('D', 2)).toBeGreaterThan(6);
  });

  it('乘子 < 1：分数收敛下压，S 锚点不变，分数恒 > 0', () => {
    expect(calcSubscore('S', 0.5)).toBeCloseTo(10);
    // D: 0.6^2 × 10 = 3.6
    expect(calcSubscore('D', 0.5)).toBeCloseTo(3.6);
    expect(calcSubscore('D', 0.5)).toBeGreaterThan(0);
  });
});

describe('deriveGradeFromScore（维度分→评级）', () => {
  it('阈值取相邻等级中点（满分 10）', () => {
    expect(deriveGradeFromScore(10)).toBe('S');
    expect(deriveGradeFromScore(9.5)).toBe('S');
    expect(deriveGradeFromScore(9.4)).toBe('A');
    expect(deriveGradeFromScore(8.5)).toBe('A');
    expect(deriveGradeFromScore(7.5)).toBe('B');
    expect(deriveGradeFromScore(6.5)).toBe('C');
    expect(deriveGradeFromScore(6.4)).toBe('D');
    expect(deriveGradeFromScore(0)).toBe('D');
  });

  it('满分为 0 时一律 D（防除零）', () => {
    expect(deriveGradeFromScore(5, 0)).toBe('D');
  });
});

describe('deriveGrade（总分→评级）', () => {
  it('阈值 0.9/0.8/0.7/0.6', () => {
    expect(deriveGrade(60, 60)).toBe('S');
    expect(deriveGrade(54, 60)).toBe('S');
    expect(deriveGrade(53, 60)).toBe('A');
    expect(deriveGrade(48, 60)).toBe('A');
    expect(deriveGrade(42, 60)).toBe('B');
    expect(deriveGrade(36, 60)).toBe('C');
    expect(deriveGrade(35, 60)).toBe('D');
  });

  it('满分为 0 时一律 D（防除零）', () => {
    expect(deriveGrade(10, 0)).toBe('D');
  });
});

describe('getDimensionMaxScore（权重满分）', () => {
  it('已知维度按权重缩放（总分 60）', () => {
    expect(getDimensionMaxScore('theme_positioning')).toBeCloseTo(18); // 30%
    expect(getDimensionMaxScore('content_richness')).toBeCloseTo(12); // 20%
    expect(getDimensionMaxScore('development_depth')).toBeCloseTo(6); // 10%
  });

  it('未知维度回退等权（60/6=10）', () => {
    expect(getDimensionMaxScore('not_exist')).toBeCloseTo(10);
  });
});

describe('calculate（完整评分）', () => {
  const allRationales = Object.fromEntries(gaokaoSubscoreIds.map((id) => [id, '理由']));

  function gradesOf(grade: ReportRating): Record<string, ReportRating> {
    return Object.fromEntries(gaokaoSubscoreIds.map((id) => [id, grade]));
  }

  it('全 S：满分 60，评级 S', () => {
    const result = calculate({ grades: gradesOf('S'), rationales: allRationales });
    expect(result.maxScore).toBe(GAOKAO_MAX_SCORE);
    expect(result.totalScore).toBeCloseTo(60);
    expect(result.grade).toBe('S');
    expect(result.subscores).toHaveLength(6);
  });

  it('权重缩放：审题立意 S 级得 18 分（10 × 0.30 × 6）', () => {
    const result = calculate({ grades: gradesOf('S'), rationales: allRationales });
    const theme = result.subscores.find((s) => s.id === 'theme_positioning')!;
    expect(theme.score).toBeCloseTo(18);
    expect(theme.maxScore).toBeCloseTo(18);
  });

  it('缺失维度：分数 0、评级 D，其余正常', () => {
    const grades = gradesOf('A');
    delete grades.development_innovation;
    const result = calculate({ grades, rationales: allRationales });
    const missing = result.subscores.find((s) => s.id === 'development_innovation')!;
    expect(missing.score).toBe(0);
    expect(missing.grade).toBe('D');
    expect(result.totalScore).toBeLessThan(60);
  });

  it('保底机制：总分评级被中位数维度评级托底', () => {
    // 5 个 S + 审题立意 D：总分 60 - 18 + 6×0.30×6 = 52.8 → 比例 0.88 → A；
    // 但维度评级中位数为 S（排序后第 3 位），保底抬升至 S。
    // 若把 D 放在小权重维度（总分 57.6 → 0.96 → 本就是 S）则触发不了保底，
    // 故特意选最大权重维度制造"总分评级低于中位数"的落差。
    const grades = gradesOf('S');
    grades.theme_positioning = 'D';
    const result = calculate({ grades, rationales: allRationales });
    expect(result.totalScore).toBeCloseTo(52.8);
    expect(result.grade).toBe('S');
  });

  it('保底机制不反向抬升：全 B 时总分评级保持 A（不被中位数压低）', () => {
    const result = calculate({ grades: gradesOf('B'), rationales: allRationales });
    // 全 B：48/60 = 0.8 → A；中位数 B 不会把 A 压到 B 以下……
    // 保底仅在"当前评级比中位数更差"时生效，A 优于 B，保持 A
    expect(result.totalScore).toBeCloseTo(48);
    expect(result.grade).toBe('A');
  });

  it('理由缺失时填空字符串，不影响计算', () => {
    const result = calculate({ grades: gradesOf('C'), rationales: {} });
    expect(result.subscores.every((s) => s.rationale === '')).toBe(true);
    expect(result.totalScore).toBeGreaterThan(0);
  });
});
