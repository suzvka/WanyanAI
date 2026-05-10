/**
 * 服务端输出模式入口
 *
 * 向后兼容的重导出层，所有调用转发到 OutputModeRegistry。
 */

import 'server-only';

import {
  outputModeRegistry,
} from './output-modes/registry';
import type { ReportScoringContext } from '@/types/analysis';
import type { PageModuleConfig } from '@/types/module';

export type BuildScoringContextParams = {
  moduleConfig: PageModuleConfig;
  controlSelections: Record<string, string>;
};

export function getServerOutputModePrompt(id: string): string | undefined {
  return outputModeRegistry.getPrompt(id);
}

export function getServerOutputModeIds(): string[] {
  return outputModeRegistry.getIds();
}

export function validateOutputModeData(
  id: string,
  data: unknown
): { success: boolean; data?: unknown; errors?: Array<{ path: string; message: string }> } {
  return outputModeRegistry.validate(id, data);
}

export function buildOutputModeScoringContext(
  id: string,
  params: BuildScoringContextParams
): ReportScoringContext | undefined {
  return outputModeRegistry.buildScoringContext(id, params);
}

export function assembleOutputModeData(
  id: string,
  collectedData: Record<string, unknown[]>
): { success: boolean; data?: Record<string, unknown>; error?: string } {
  return outputModeRegistry.assemble(id, collectedData);
}

export function getOutputModeTools(id: string) {
  return outputModeRegistry.getTools(id);
}

export function resolveOutputModeToolCall(
  id: string,
  toolName: string,
  params: Record<string, unknown>
) {
  return outputModeRegistry.resolveToolCall(id, toolName, params);
}

export { outputModeRegistry } from './output-modes/registry';
