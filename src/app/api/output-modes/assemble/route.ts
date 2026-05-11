import { NextRequest } from 'next/server';
import { getErrorMessage, outputModeError, outputModeSuccess } from '../_shared';
import { assembleOutputModeData } from '@/server/output-modes';
import { createLogger } from '@/lib/api-station/logger';

const logger = createLogger('API:assemble');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { outputModeId, collectedData } = body as {
      outputModeId: string;
      collectedData: Record<string, unknown[]>;
    };

    if (!outputModeId || !collectedData) {
      return outputModeError('Missing required parameters', 400);
    }

    const result = await assembleOutputModeData(outputModeId, collectedData);
    return result.success
      ? outputModeSuccess(result.data)
      : outputModeError(result.error ?? 'Unknown error', 200);
  } catch (error) {
    logger.error('assemble error', error);
    return outputModeError(getErrorMessage(error), 500);
  }
}
