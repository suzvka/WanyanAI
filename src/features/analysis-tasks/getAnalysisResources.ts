'use server';

/**
 * 服务端资源获取接口
 *
 * 这些 Server Actions 只提供资源（提示词、编译结果等），
 * 不涉及模型调用和 API Key，确保服务端不知道客户端的密钥。
 *
 * 注意：MCP 工具定义不在服务端获取，因为它们包含不可序列化的 handler 和 Zod schema。
 * 客户端应该直接使用 getOutputModeMcpTools() 获取工具定义。
 */

import {
  requestCompiledInstructions,
  requestCompiledMcpPrompt,
} from '@/features/analysis-flow/lib';
import {
  getServerOutputModePrompt,
  getServerOutputModeName,
  getServerOutputModeDescription,
  validateOutputModeData,
  buildOutputModeScoringContext,
  assembleOutputModeData,
  resolveOutputModeToolCall,
} from '@/server/output-modes';
import type { ControlSelections } from '@/providers/PageContext';
import type { PageModuleConfig } from '@/types/module';

/**
 * 获取单个步骤的分析资源（Agent 使用）
 *
 * 与 getAnalysisResources 类似，但接受显式的 outputModeId 参数，
 * 使 Agent 编排器可以为中间步骤请求不同输出模式的资源。
 */
export async function getStepResources(input: {
  outputModeId: string;
  moduleConfig: PageModuleConfig;
  controlSelections: ControlSelections;
}): Promise<{
  systemPrompt: string;
  instructionText: string;
  mcpToolText: string;
}> {
  const { outputModeId, moduleConfig, controlSelections } = input;

  const systemPrompt = getServerOutputModePrompt(outputModeId);
  if (!systemPrompt) {
    throw new Error(`Output mode "${outputModeId}" not found or has no prompt`);
  }

  const compiledInstructions = await requestCompiledInstructions({
    controlSelections,
    configVersion: moduleConfig.manifest.slug,
  });

  const compiledMcpPrompt = await requestCompiledMcpPrompt({
    outputModeId,
  });

  return {
    systemPrompt,
    instructionText: compiledInstructions.instructionText,
    mcpToolText: compiledMcpPrompt.toolPromptText,
  };
}

/**
 * 批量获取输出模式的元数据（名称 + 功能描述）
 *
 * Agent 编排器使用此接口获取各模式的描述信息，用于构建 tool 的 description 字段，
 * 帮助 Agent LLM 决策调用哪个输出模式。
 */
export async function getOutputModeMetas(ids: string[]): Promise<
  Array<{ id: string; name: string; description: string }>
> {
  return ids.map((id) => ({
    id,
    name: getServerOutputModeName(id) ?? id,
    description: getServerOutputModeDescription(id) ?? '',
  }));
}

/**
 * 获取分析任务所需的资源
 *
 * 返回客户端调用模型所需的所有资源，但不执行模型调用。
 * 注意：MCP 工具定义需要客户端通过 getOutputModeMcpTools() 获取。
 */
export async function getAnalysisResources(input: {
  moduleConfig: PageModuleConfig;
  controlSelections: ControlSelections;
}): Promise<{
  systemPrompt: string;
  instructionText: string;
  mcpToolText: string;
}> {
  const { moduleConfig, controlSelections } = input;

  // 1. 获取系统提示词
  const systemPrompt = getServerOutputModePrompt(moduleConfig.manifest.outputMode);
  if (!systemPrompt) {
    throw new Error(`Output mode "${moduleConfig.manifest.outputMode}" not found or has no prompt`);
  }

  // 2. 编译控件指令
  const compiledInstructions = await requestCompiledInstructions({
    controlSelections,
    configVersion: moduleConfig.manifest.slug,
  });

  // 3. 获取 MCP 工具提示词
  const compiledMcpPrompt = await requestCompiledMcpPrompt({
    outputModeId: moduleConfig.manifest.outputMode,
  });

  return {
    systemPrompt,
    instructionText: compiledInstructions.instructionText,
    mcpToolText: compiledMcpPrompt.toolPromptText,
  };
}

/**
 * 验证模型输出数据
 *
 * 客户端调用模型后，将结果发送到这里验证。
 */
export async function validateAnalysisOutput(input: {
  outputModeId: string;
  toolName: string;
  toolParams: Record<string, unknown>;
}): Promise<{
  success: boolean;
  data?: unknown;
  errors?: Array<{ path: string; message: string }>;
}> {
  const { outputModeId, toolName, toolParams } = input;

  // 调试日志
  console.log('[validateAnalysisOutput] Input:', {
    outputModeId,
    toolName,
    toolParamsKeys: Object.keys(toolParams),
  });

  // 1. 解析工具调用
  const resolution = resolveOutputModeToolCall(outputModeId, toolName, toolParams);

  if (resolution.type === 'abort') {
    return {
      success: false,
      errors: [{ path: '(root)', message: `${resolution.reason}: ${resolution.message}` }],
    };
  }

  let toolData: Record<string, unknown>;

  if (toolName === 'multi_collect_complete') {
    // 多工具收集模式
    const assembledData = assembleOutputModeData(outputModeId, toolParams as Record<string, unknown[]>);
    if (!assembledData.success) {
      return {
        success: false,
        errors: [{ path: '(root)', message: assembledData.error || '数据拼装失败' }],
      };
    }
    toolData = assembledData.data!;
  } else if (resolution.type === 'data') {
    toolData = resolution.data ?? {};
  } else if (resolution.type === 'finalize') {
    // 检查 toolParams 是否包含收集的数据（来自 streamingAdapter 的合并）
    const hasCollectedData = Object.keys(toolParams).some(key => 
      key.startsWith('collect_') && Array.isArray(toolParams[key])
    );
    
    console.log('[validateAnalysisOutput] Finalize branch:', {
      hasCollectedData,
      toolParamsKeys: Object.keys(toolParams),
    });
    
    if (hasCollectedData) {
      // 使用传入的收集数据
      const assembledData = assembleOutputModeData(outputModeId, toolParams as Record<string, unknown[]>);
      if (!assembledData.success) {
        return {
          success: false,
          errors: [{ path: '(root)', message: assembledData.error || '数据拼装失败' }],
        };
      }
      toolData = assembledData.data ?? {};
    } else {
      // 兼容旧逻辑：传入空对象
      const assembledData = assembleOutputModeData(outputModeId, {} as Record<string, unknown[]>);
      if (!assembledData.success) {
        return {
          success: false,
          errors: [{ path: '(root)', message: assembledData.error || '数据拼装失败' }],
        };
      }
      toolData = assembledData.data ?? {};
    }
  } else {
    return {
      success: false,
      errors: [{ path: '(root)', message: `未知工具调用: ${toolName}` }],
    };
  }

  // 调试日志：打印组装后的数据
  console.log('[validateAnalysisOutput] Assembled toolData:', JSON.stringify(toolData, null, 2));

  // 2. 验证数据结构
  const validation = validateOutputModeData(outputModeId, toolData);

  return {
    success: validation.success,
    data: validation.data,
    errors: validation.errors,
  };
}

/**
 * 构建评分上下文
 *
 * 用于最终报告的评分计算。
 */
export async function buildScoringContext(input: {
  outputModeId: string;
  moduleConfig: PageModuleConfig;
  controlSelections: ControlSelections;
}): Promise<{
  scoringContext: ReturnType<typeof buildOutputModeScoringContext>;
}> {
  const { outputModeId, moduleConfig, controlSelections } = input;

  const scoringContext = buildOutputModeScoringContext(outputModeId, {
    moduleConfig,
    controlSelections,
  });

  return {
    scoringContext: scoringContext ?? { multipliers: {}, defaultMultiplier: 1 },
  };
}

/**
 * 构建重试消息
 *
 * 当验证失败需要重试时，构建重试提示词。
 */
export async function buildRetryMessage(input: {
  outputModeId: string;
  issues: Array<{ path: string; message: string }>;
  previousData: Record<string, unknown>;
  attempt: number;
  maxAttempts: number;
}): Promise<string> {
  const { buildValidationRetryMessage } = await import('@/features/analysis-flow/lib/buildValidationRetryMessage');
  return buildValidationRetryMessage({
    outputModeId: input.outputModeId,
    issues: input.issues,
    previousReportData: input.previousData,
    attempt: input.attempt,
    maxAttempts: input.maxAttempts,
  });
}
