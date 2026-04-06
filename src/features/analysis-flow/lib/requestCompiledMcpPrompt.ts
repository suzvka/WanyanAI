import { requestJson } from '@/lib/client-request';
import { createAppError } from '@/types/errors';
import type { McpCompileErrorResponse, McpCompileSuccessResponse } from '@/mcp';

type RequestCompiledMcpPromptPayload = {
  outputModeId?: string;
};

export async function requestCompiledMcpPrompt(payload: RequestCompiledMcpPromptPayload = {}) {
  const data = await requestJson<McpCompileSuccessResponse | McpCompileErrorResponse>('/api/mcp/compile', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    errorMessage: 'MCP 指令请求失败。',
    networkErrorMessage: 'MCP 指令请求失败，请检查网络连接后重试。',
  });

  if (!data || !('toolPromptText' in data)) {
    throw createAppError({
      code: 'unknown_error',
      message: 'MCP 指令响应格式异常。',
    });
  }

  return data;
}