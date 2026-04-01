/**
 * JSON 修复模块
 * 
 * 提供基于 LLM 的 JSON 格式修复能力
 * 
 * @example
 * ```ts
 * import { jsonRepairService, REPORT_JSON_PROMPT } from '@/features/json-repair';
 * 
 * const result = await jsonRepairService.repair(
 *   {
 *     baseUrl: 'https://api.example.com',
 *     apiKey: 'xxx',
 *     model: 'gpt-4',
 *     progressController,
 *   },
 *   {
 *     schemaPrompt: REPORT_JSON_PROMPT,
 *     malformedJson: '{"summary": {...}',
 *   }
 * );
 * ```
 */

// 导出类型
export type {
  JsonRepairConfig,
  JsonRepairParams,
  JsonRepairResult,
  JsonRepairService,
} from './types';

// 导出服务
export { jsonRepairService } from './service';

// 导出提示词（从 report-json 模块重新导出，方便使用）
export { REPORT_JSON_PROMPT } from '@/features/output-modes/report-json/prompt';
