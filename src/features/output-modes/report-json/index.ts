import type { OutputModeDefinition } from '../registry';
import { ReportJsonRenderer } from './renderer';
import { REPORT_JSON_PROMPT } from './prompt';
import type { ReportJsonData, ReportJsonRawInput } from './types';

/**
 * 验证数据是否为有效的 ReportJsonRawInput
 */
function isReportJsonRawInput(data: unknown): data is ReportJsonRawInput {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const obj = data as Record<string, unknown>;

  return (
    obj.rawJson !== undefined &&
    obj.metadata !== undefined &&
    typeof obj.metadata === 'object'
  );
}

/**
 * report-json 输出模式定义
 *
 * 完全自治的输出模式：
 * - 接收原始 JSON 数据 + 元数据
 * - 内部完成验证、标准化、评分、渲染
 */
export const reportJsonMode: OutputModeDefinition<ReportJsonRawInput> = {
  id: 'report-json',
  name: '标准报告 JSON',
  prompt: REPORT_JSON_PROMPT,
  Renderer: ReportJsonRenderer,
  validate: isReportJsonRawInput,
};

// === 公开 API ===

// 导出渲染器
export { ReportJsonRenderer } from './renderer';

// 导出提示词
export { REPORT_JSON_PROMPT } from './prompt';

// 导出类型
export type { ReportJsonData, ReportJsonRawInput } from './types';
