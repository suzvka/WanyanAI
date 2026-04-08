/**
 * 服务端输出模式入口
 *
 * 向后兼容的重导出层，所有调用转发到新的注册表
 */

import 'server-only';

import {
  outputModeRegistry,
} from './output-modes/registry';
import type { ReportScoringContext } from '@/types/analysis';
import type { PageModuleConfig } from '@/types/module';

// 重新导出类型
export type BuildScoringContextParams = {
  moduleConfig: PageModuleConfig;
  controlSelections: Record<string, string>;
};

/**
 * 获取服务端输出模式提示词
 */
export function getServerOutputModePrompt(id: string): string | undefined {
  return outputModeRegistry.getPrompt(id);
}

/**
 * 获取已注册的输出模式 ID 列表
 */
export function getServerOutputModeIds(): string[] {
  return outputModeRegistry.getIds();
}

/**
 * 验证输出模式数据
 */
export function validateOutputModeData(
  id: string,
  data: unknown
): { success: boolean; data?: unknown; errors?: Array<{ path: string; message: string }> } {
  return outputModeRegistry.validate(id, data);
}

/**
 * 构建输出模式评分上下文
 */
export function buildOutputModeScoringContext(
  id: string,
  params: BuildScoringContextParams
): ReportScoringContext | undefined {
  return outputModeRegistry.buildScoringContext(id, params);
}

/**
 * 拼装输出模式数据（多工具收集模式）
 *
 * 从多个工具调用结果中拼装完整的报告数据
 */
export function assembleOutputModeData(
  id: string,
  collectedData: Record<string, unknown[]>
): { success: boolean; data?: Record<string, unknown>; error?: string } {
  return outputModeRegistry.assemble(id, collectedData);
}

// 导出新的注册表供高级用法
export { outputModeRegistry } from './output-modes/registry';
