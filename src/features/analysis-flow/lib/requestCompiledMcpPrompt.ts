import { compileMcpPrompt } from '@/mcp';
import { createAppError } from '@/types/errors';
import { outputModeRegistry } from '@/server/output-modes/registry';
import type { McpCompileSuccessResponse, McpToolDefinition } from '@/mcp';

type RequestCompiledMcpPromptPayload = {
  outputModeId?: string;
};

/**
 * 请求编译 MCP 提示词
 * 
 * 在服务端直接调用 compileMcpPrompt，避免 HTTP 请求
 */
export async function requestCompiledMcpPrompt(payload: RequestCompiledMcpPromptPayload = {}) {
  try {
    const { outputModeId } = payload;
    let tools: McpToolDefinition[] = [];

    if (outputModeId) {
      tools = outputModeRegistry.getTools(outputModeId);
      if (tools.length === 0) {
        throw createAppError({
          code: 'config_invalid',
          message: `未找到输出模式模块：${outputModeId}`,
        });
      }
    }

    const compiled = compileMcpPrompt(tools);
    return compiled as McpCompileSuccessResponse;
  } catch (error) {
    throw createAppError({
      code: 'unknown_error',
      message: error instanceof Error ? error.message : 'MCP 提示词编译失败',
    });
  }
}
