import type { AppErrorPayload } from '@/types/errors';
import type { infer as ZodInfer, ZodTypeAny } from 'zod';

export type McpToolParameterType = 'string' | 'number' | 'boolean' | 'object' | 'array';

export type McpToolParameter = {
  name: string;
  description: string;
  required: boolean;
  type: McpToolParameterType;
};

export type McpToolHandlerResult<TData = unknown> = {
  ok: boolean;
  data?: TData;
  message?: string;
  terminate?: boolean;
};

export type McpInvokeContext = {
  moduleId?: string;
  taskId?: string;
  userRef?: string | null;
  source?: 'analysis-workflow' | 'manual' | 'unknown';
};

export type McpToolHandler<
  TSchema extends ZodTypeAny = ZodTypeAny,
  TResult = unknown,
> = (
  args: ZodInfer<TSchema>,
  context: McpInvokeContext,
) => Promise<McpToolHandlerResult<TResult>> | McpToolHandlerResult<TResult>;

export type McpToolDefinition<
  TSchema extends ZodTypeAny = ZodTypeAny,
  TResult = unknown,
> = {
  name: string;
  description: string;
  parameters: McpToolParameter[];
  inputSchema: TSchema;
  handler: McpToolHandler<TSchema, TResult>;
};

export function defineMcpTool<
  TSchema extends ZodTypeAny,
  TResult = unknown,
>(definition: McpToolDefinition<TSchema, TResult>): McpToolDefinition<TSchema, TResult> {
  return definition;
}

export type McpPromptToolDescriptor = {
  name: string;
  description: string;
  parameters: McpToolParameter[];
};

export type McpCompiledPrompt = {
  toolPromptText: string;
  tools: McpPromptToolDescriptor[];
};

export type McpCompileRequest = {
  moduleId?: string;
};

export type McpCompileSuccessResponse = McpCompiledPrompt;

export type McpCompileErrorResponse = {
  error: AppErrorPayload;
};