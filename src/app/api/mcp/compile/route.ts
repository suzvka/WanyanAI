import { NextResponse } from 'next/server';
import { z } from 'zod';
import { compileMcpPrompt, type McpCompileErrorResponse, type McpCompileSuccessResponse } from '@/mcp';
import type { McpToolDefinition } from '@/mcp/types';
import { outputModeRegistry } from '@/server/output-modes/registry';
import { toAppErrorPayload } from '@/types/errors';

const compileMcpRequestSchema = z.object({
  outputModeId: z.string().trim().min(1).optional(),
});

export async function POST(request: Request) {
  try {
    const parsed = compileMcpRequestSchema.safeParse(await request.json());

    if (!parsed.success) {
      const response: McpCompileErrorResponse = {
        error: {
          code: 'invalid_input',
          message: parsed.error.issues[0]?.message || 'MCP 提示词编译输入不合法',
          status: 400,
        },
      };

      return NextResponse.json(response, { status: 400 });
    }

    const outputModeId = parsed.data.outputModeId;
    let tools: McpToolDefinition[] = [];

    if (outputModeId) {
      tools = outputModeRegistry.getTools(outputModeId);
      if (tools.length === 0) {
        const response: McpCompileErrorResponse = {
          error: {
            code: 'config_invalid',
            message: `未找到输出模式模块：${outputModeId}`,
            status: 404,
          },
        };
        return NextResponse.json(response, { status: 404 });
      }
    }

    const compiled = compileMcpPrompt(tools);
    const response: McpCompileSuccessResponse = compiled;

    return NextResponse.json(response);
  } catch (error) {
    const payload = toAppErrorPayload(error, {
      code: 'unknown_error',
      message: 'MCP 提示词编译失败',
      status: 500,
      retryable: true,
    });
    const response: McpCompileErrorResponse = {
      error: payload,
    };

    return NextResponse.json(response, { status: payload.status ?? 500 });
  }
}