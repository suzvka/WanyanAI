/**
 * 获取输出模式工具定义 API
 *
 * GET /api/output-modes/tools?outputModeId=xxx
 */

import { NextRequest } from 'next/server';
import { outputModeError, outputModeSuccess } from '../_shared';
import { getOutputModeModule } from '@/server/output-modes/registry';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const outputModeId = searchParams.get('outputModeId');

  if (!outputModeId) {
    return outputModeError('Missing outputModeId parameter', 400);
  }

  const outputModeModule = getOutputModeModule(outputModeId);
  if (!outputModeModule) {
    return outputModeError(`Output mode '${outputModeId}' not found`, 404);
  }

  // 返回工具定义
  const toolDefinitions = outputModeModule.mcpToolDefinitions || [];

  return outputModeSuccess({
    outputModeId,
    tools: toolDefinitions.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    })),
  });
}
