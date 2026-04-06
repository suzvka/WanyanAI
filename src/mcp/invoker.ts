import { createAppError } from '@/types/errors';
import { getMcpTool } from './registry';
import type { McpInvokeContext, McpToolHandlerResult } from './types';

export async function invokeMcpTool(
  name: string,
  rawArgs: unknown,
  context: McpInvokeContext = {},
): Promise<McpToolHandlerResult> {
  const tool = getMcpTool(name);

  if (!tool) {
    throw createAppError({
      code: 'config_invalid',
      message: `δҵ MCP ߣ${name}`,
    });
  }

  const parsedArgs = tool.inputSchema.safeParse(rawArgs);
  if (!parsedArgs.success) {
    throw createAppError({
      code: 'invalid_input',
      message: parsedArgs.error.issues[0]?.message || `MCP ߲Ϸ${name}`,
      status: 400,
    });
  }

  return tool.handler(parsedArgs.data, context);
}