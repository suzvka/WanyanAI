import { NextRequest } from 'next/server';
import { outputModeError, outputModeSuccess } from '../_shared';
import { outputModeRegistry } from '@/server/output-modes/registry';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const outputModeId = searchParams.get('outputModeId');

  if (!outputModeId) {
    return outputModeError('Missing outputModeId parameter', 400);
  }

  const toolDefinitions = outputModeRegistry.getTools(outputModeId);

  if (toolDefinitions.length === 0) {
    return outputModeError(`Output mode '${outputModeId}' not found`, 404);
  }

  return outputModeSuccess({
    outputModeId,
    tools: toolDefinitions.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    })),
  });
}
