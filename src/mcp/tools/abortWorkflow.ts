import { z } from 'zod';
import type { McpToolDefinition } from '@/mcp/types';

const abortWorkflowInputSchema = z.object({
  reason: z.string().trim().min(1, 'reason 不能为空'),
  message: z.string().trim().min(1, 'message 不能为空'),
});

export const abortWorkflowTool: McpToolDefinition<typeof abortWorkflowInputSchema, { reason: string }> = {
  name: 'abort_workflow',
  description: '在当前不适合时中止工作流',
  parameters: [
    {
      name: 'reason',
      description: '中止原因标识',
      required: true,
      type: 'string',
    },
    {
      name: 'message',
      description: '向用户展示中止的说明',
      required: true,
      type: 'string',
    },
  ],
  inputSchema: abortWorkflowInputSchema,
  handler: ({ reason, message }) => ({
    ok: true,
    data: { reason },
    message,
    terminate: true,
  }),
};