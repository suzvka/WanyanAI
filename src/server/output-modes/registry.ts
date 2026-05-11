/**
 * 输出模式注册表
 *
 * 延迟初始化：单例实例在加载时创建（无副作用），内置模块通过 initialize() 注册，
 * reset() 用于测试隔离和热重置。
 */

import 'server-only';

import { BaseRegistry } from '@/lib/registry/BaseRegistry';
import type { McpToolDefinition } from '@/mcp/types';
import type {
  OutputModeModule,
  OutputModeRegistry as IOutputModeRegistry,
  ValidationResult,
  BuildScoringContextParams,
  CollectedToolData,
  ToolCallResolutionResult,
} from './types';
import type { ReportScoringContext } from '@/types/analysis';
import { registerBuiltinOutputModes } from './manifest';
import { abortWorkflowTool } from '@/mcp/tools/abortWorkflow';
import { createLogger } from '@/lib/api-station/logger';

const logger = createLogger('OutputModeRegistry');

class OutputModeRegistryImpl extends BaseRegistry<OutputModeModule> implements IOutputModeRegistry {
  constructor() {
    super('OutputModeRegistry');
  }

  getPrompt(id: string): string | undefined {
    return this.modules.get(id)?.prompt;
  }

  validate(id: string, data: unknown): ValidationResult {
    const outputMode = this.modules.get(id);
    if (!outputMode) {
      return {
        success: false,
        errors: [{ path: '', message: `未找到输出模式：${id}` }],
      };
    }
    return outputMode.validate(data);
  }

  buildScoringContext(id: string, params: BuildScoringContextParams): ReportScoringContext {
    const outputMode = this.modules.get(id);
    if (!outputMode) {
      throw new Error(`未找到输出模式：${id}`);
    }
    return outputMode.buildScoringContext(params);
  }

  assemble(id: string, collectedData: CollectedToolData): { success: boolean; data?: Record<string, unknown>; error?: string } {
    const outputMode = this.modules.get(id);
    if (!outputMode) {
      return { success: false, error: `未找到输出模式：${id}` };
    }

    if (!outputMode.assemble) {
      return { success: false, error: `输出模式 ${id} 不支持多工具收集模式` };
    }

    try {
      const assembledData = outputMode.assemble(collectedData);
      return { success: true, data: assembledData as Record<string, unknown> };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '拼装数据失败',
      };
    }
  }

  /**
   * 获取模块的工具定义。
   *
   * 模块只应声明业务工具；框架工具（如 abort_workflow）由注册表统一注入，
   * 避免各模块重复声明导致版本不一致。
   */
  getTools(id: string): McpToolDefinition[] {
    const outputMode = this.modules.get(id);
    if (!outputMode) {
      return [];
    }

    const moduleTools = outputMode.mcpToolDefinitions ?? [];

    const frameworkToolNames = outputMode.getFrameworkToolNames
      ? outputMode.getFrameworkToolNames()
      : ['abort_workflow'];

    const filteredModuleTools = moduleTools.filter((tool) => {
      if (frameworkToolNames.includes(tool.name)) {
        logger.warn('Module should not declare framework tool', {
          moduleId: id,
          toolName: tool.name,
        });
        return false;
      }
      return true;
    });

    const frameworkTools: McpToolDefinition[] = [];
    if (frameworkToolNames.includes('abort_workflow')) {
      frameworkTools.push(abortWorkflowTool);
    }

    return [...filteredModuleTools, ...frameworkTools];
  }

  resolveToolCall(
    id: string,
    toolName: string,
    params: Record<string, unknown>
  ): ToolCallResolutionResult {
    const outputMode = this.modules.get(id);
    if (!outputMode) {
      return { type: 'unknown' };
    }

    if (outputMode.resolveToolCall) {
      return outputMode.resolveToolCall(toolName, params);
    }

    return createDefaultResolveToolCall(toolName, params);
  }
}

/**
 * 默认工具调用解析。
 *
 * 将常见业务工具名映射为框架语义动作，保持向后兼容。
 * 模块可通过实现 resolveToolCall 覆盖此默认行为。
 */
function createDefaultResolveToolCall(
  toolName: string,
  params: Record<string, unknown>
): ToolCallResolutionResult {
  if (toolName === 'abort_workflow') {
    return {
      type: 'abort',
      reason: params.reason as string,
      message: params.message as string,
    };
  }

  if (toolName === 'finalize_report') {
    return { type: 'finalize' };
  }

  if (toolName === 'submit_report') {
    return { type: 'data', data: params };
  }

  return { type: 'unknown' };
}

export const outputModeRegistry = new OutputModeRegistryImpl();

export function initializeOutputModes(): void {
  outputModeRegistry.initialize(() => registerBuiltinOutputModes(outputModeRegistry));
}

export function resetOutputModes(): void {
  outputModeRegistry.reset();
}

export type { OutputModeModule, ValidationResult } from './types';

export function getOutputModeModule(id: string): OutputModeModule | undefined {
  return outputModeRegistry.get(id);
}


