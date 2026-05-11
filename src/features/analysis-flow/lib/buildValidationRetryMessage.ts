type ValidationIssue = {
  path: string;
  message: string;
};

export type BuildValidationRetryMessageParams = {
  outputModeId: string;
  issues: ValidationIssue[];
  previousReportData: unknown;
  attempt: number;
  maxAttempts: number;
};

function formatIssues(issues: ValidationIssue[]): string {
  if (issues.length === 0) {
    return '1. (root): 未知结构错误，请检查全部必填字段、枚举值、数组项数量与字段名是否合法';
  }

  return issues
    .map((issue, index) => {
      const path = issue.path.trim() || '(root)';
      return `${index + 1}. ${path}: ${issue.message}`;
    })
    .join('\n');
}

function stringifyReportData(previousReportData: unknown): string {
  try {
    return JSON.stringify(previousReportData, null, 2);
  } catch {
    return String(previousReportData);
  }
}

export function buildValidationRetryMessage({
  outputModeId,
  issues,
  previousReportData,
  attempt,
  maxAttempts,
}: BuildValidationRetryMessageParams): string {
  const issueList = formatIssues(issues);
  const serializedReportData = stringifyReportData(previousReportData);

  return [
    `上一轮 ${outputModeId} 报告未通过最终结构校验。请基于下方 JSON 修正错误字段后重新完整提交整份报告。`,
    '',
    `当前为第 ${attempt + 1} 次修复提交，最多允许 ${maxAttempts} 次修复重试。`,
    '',
    '修复要求：',
    '1. 仅修正下列报错字段及其直接相关内容，未报错且合理的字段尽量保持不变。',
    '2. 你必须重新完整调用整套工具并提交完整报告，不要只返回局部补丁。',
    '3. 所有必填字段必须补齐，枚举值和字段名必须严格合法。',
    '4. 最后仍必须以 finalize_report 结束。',
    '',
    '校验错误：',
    issueList,
    '',
    '上一轮提交的结构化报告 JSON：',
    '```json',
    serializedReportData,
    '```',
  ].join('\n');
}
