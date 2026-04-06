'use server';

import { validateOutputModeData, buildOutputModeScoringContext, getServerOutputModeIds, assembleOutputModeData } from '@/server/output-modes';
import type { ReportScoringContext } from '@/types/analysis';
import type { ModuleConfig } from '@/types/module';

/**
 * 验证输出模式数据（服务端 Action）
 */
export async function serverValidateOutputModeData(
  outputModeId: string,
  data: unknown
): Promise<{ success: boolean; data?: unknown; errors?: Array<{ path: string; message: string }> }> {
  return validateOutputModeData(outputModeId, data);
}

/**
 * 构建输出模式评分上下文（服务端 Action）
 */
export async function serverBuildOutputModeScoringContext(
  outputModeId: string,
  params: { moduleConfig: ModuleConfig; controlSelections: Record<string, string> }
): Promise<ReportScoringContext | undefined> {
  return buildOutputModeScoringContext(outputModeId, params);
}

/**
 * 拼装输出模式数据（服务端 Action）
 *
 * 从多个工具调用结果中拼装完整的报告数据
 */
export async function serverAssembleOutputModeData(
  outputModeId: string,
  collectedData: Record<string, unknown[]>
): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> {
  return assembleOutputModeData(outputModeId, collectedData);
}

/**
 * 获取可用的输出模式 ID 列表（服务端 Action）
 */
export async function serverGetOutputModeIds(): Promise<string[]> {
  return getServerOutputModeIds();
}
