/**
 * I2 — 文学评审报告模型输出校验单测
 *
 * 覆盖：合法报告、6 维度完整性、重复维度、sections 必填、
 * 评级枚举、严格字段约束。
 */
import { describe, it, expect } from 'vitest';
import { validate, getValidationDiagnostics } from './validate';
import { defaultSubscoreIds } from './subscores';

/** 构造一份合法的最小报告 */
function validReport() {
  return {
    summary: { title: '总评', overview: '整体概述' },
    subscores: defaultSubscoreIds.map((id) => ({
      id,
      grade: 'B' as const,
      rationale: `${id} 的理由`,
    })),
    conclusion: { rationale: '结论说明' },
    sections: [
      { sectionTitle: '章节', paragraphTitle: '段落', body: '引文与评析' },
    ],
  };
}

describe('validate（合法输入）', () => {
  it('标准报告通过校验', () => {
    const result = validate(validReport());
    expect(result.success).toBe(true);
    expect(result.data?.subscores).toHaveLength(6);
  });
});

describe('validate（非法输入）', () => {
  it('缺少维度 → 报缺', () => {
    const report = validReport();
    report.subscores = report.subscores.slice(0, 4);
    const result = validate(report);
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.message.includes('缺少子维度'))).toBe(true);
  });

  it('重复维度 → 报重复', () => {
    const report = validReport();
    report.subscores.push({ ...report.subscores[0] });
    const result = validate(report);
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.message.includes('重复'))).toBe(true);
  });

  it('sections 缺失或为空 → 拒绝（本模式 sections 必填）', () => {
    const report = validReport() as Record<string, unknown>;
    delete report.sections;
    expect(validate(report).success).toBe(false);

    const empty = validReport();
    empty.sections = [];
    expect(validate(empty).success).toBe(false);
  });

  it('section 缺少必需字段（paragraphTitle）→ 拒绝', () => {
    const report = validReport();
    report.sections = [{ sectionTitle: '章节', body: '正文' }] as never;
    expect(validate(report).success).toBe(false);
  });

  it('非法评级枚举 → 拒绝', () => {
    const report = validReport();
    report.subscores[0].grade = 'E' as never;
    expect(validate(report).success).toBe(false);
  });

  it('空白必填字段 → 拒绝', () => {
    const report = validReport();
    report.summary.overview = '   ';
    expect(validate(report).success).toBe(false);
  });
});

describe('getValidationDiagnostics', () => {
  it('合法输入零错误；非法输入错误数一致', () => {
    expect(getValidationDiagnostics(validReport()).isValid).toBe(true);
    const bad = getValidationDiagnostics({});
    expect(bad.isValid).toBe(false);
    expect(bad.errors.length).toBe(bad.errorCount);
  });
});
