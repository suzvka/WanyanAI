import { NextResponse } from 'next/server';
import { outputModeError, outputModeSuccess } from '../_shared';
import { buildOutputModeScoringContext } from '@/server/output-modes';
import { toAppErrorPayload } from '@/types/errors';
import type { ModuleConfig } from '@/types/module';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { outputModeId, params } = body as {
      outputModeId: string;
      params: { moduleConfig: ModuleConfig; controlSelections: Record<string, string> };
    };

    if (!outputModeId || !params) {
      return outputModeError('Missing outputModeId or params', 400);
    }

    const scoringContext = await buildOutputModeScoringContext(outputModeId, params);

    return outputModeSuccess(scoringContext ?? { multipliers: {}, defaultMultiplier: 1 });
  } catch (error) {
    const payload = toAppErrorPayload(error, {
      code: 'unknown_error',
      message: 'Failed to build scoring context',
      status: 500,
      retryable: true,
    });

    return outputModeError(payload.message, payload.status ?? 500);
  }
}
