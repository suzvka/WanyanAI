/**
 * 获取输出模式工具定义 API
 *
 * GET /api/output-modes/tools?outputModeId=xxx
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOutputModeModule } from '@/server/output-modes/registry';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const outputModeId = searchParams.get('outputModeId');

  if (!outputModeId) {
    return NextResponse.json(
      { error: 'Missing outputModeId parameter' },
      { status: 400 }
    );
  }

  const outputModeModule = getOutputModeModule(outputModeId);
  if (!outputModeModule) {
    return NextResponse.json(
      { error: `Output mode '${outputModeId}' not found` },
      { status: 404 }
    );
  }

  // 返回工具定义
  const toolDefinitions = outputModeModule.mcpToolDefinitions || [];

  return NextResponse.json({
    success: true,
    data: {
      outputModeId,
      tools: toolDefinitions.map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      })),
    },
  });
}
