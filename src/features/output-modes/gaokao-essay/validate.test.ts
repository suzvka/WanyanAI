/**
 * I2 — 高考作文报告模型输出校验单测
 *
 * 覆盖：合法报告、6 维度完整性、重复维度、groups/sections 二选一、
 * 评级枚举、strict 额外字段拒绝、空 title 归一。
 */
import { describe, it, expect } from 'vitest';
import { validate, getValidationDiagnostics } from './validate';
import { gaokaoSubscoreIds } from './subscores';

/** 构造一份合法的最小报告 */
function validReport() {
  return {
    summary: { title: '总评', overview: '整体概述' },
    subscores: gaokaoSubscoreIds.map((id) => ({
      id,
      grade: 'A' as const,
      rationale: `${id} 的理由`,
    })),
    conclusion: { rationale: '结论说明' },
    sections: [{ title: '第一节', body: '正文内容' }],
  };
}

describe('validate（合法输入）', () => {
  it('标准报告通过校验', () => {
    const result = validate(validReport());
    expect(result.success).toBe(true);
    expect(result.data?.subscores).toHaveLength(6);
  });

  it('title 为空字符串时归一为 undefined', () => {
    const report = validReport();
    report.summary.title = '   ';
    const result = validate(report);
    expect(result.success).toBe(true);
    expect(result.data?.summary.title).toBeUndefined();
  });

  it('groups 与 sections 二选一即可（仅 groups 也合法）', () => {
    const report = validReport() as Record<string, unknown>;
    delete report.sections;
    report.groups = [
      { title: '组一', sections: [{ title: '节', body: '正文' }] },
    ];
    expect(validate(report).success).toBe(true);
  });
});

describe('validate（非法输入）', () => {
  it('缺少任一维度 → 明确报缺', () => {
    const report = validReport();
    report.subscores = report.subscores.slice(0, 5);
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

  it('groups 与 sections 均缺失 → 拒绝', () => {
    const report = validReport() as Record<string, unknown>;
    delete report.sections;
    const result = validate(report);
    expect(result.success).toBe(false);
    expect(
      result.errors?.some((e) => e.message.includes('必须包含 groups 或 sections')),
    ).toBe(true);
  });

  it('非法评级枚举 → 拒绝', () => {
    const report = validReport();
    report.subscores[0].grade = 'X' as never;
    expect(validate(report).success).toBe(false);
  });

  it('未知维度 id → 拒绝', () => {
    const report = validReport();
    report.subscores[0].id = 'unknown_dimension' as never;
    expect(validate(report).success).toBe(false);
  });

  it('strict 模式：额外字段拒绝', () => {
    const report = { ...validReport(), extraField: true };
    expect(validate(report).success).toBe(false);
  });

  it('空白字符串必填字段 → 拒绝', () => {
    const report = validReport();
    report.conclusion.rationale = '   ';
    expect(validate(report).success).toBe(false);
  });
});

describe('getValidationDiagnostics', () => {
  it('合法输入：零错误', () => {
    const d = getValidationDiagnostics(validReport());
    expect(d.isValid).toBe(true);
    expect(d.errorCount).toBe(0);
  });

  it('非法输入：错误数与详情一致', () => {
    const d = getValidationDiagnostics({});
    expect(d.isValid).toBe(false);
    expect(d.errorCount).toBeGreaterThan(0);
    expect(d.errors.length).toBe(d.errorCount);
  });
});
