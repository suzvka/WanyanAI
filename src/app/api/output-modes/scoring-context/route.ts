import { NextResponse } from 'next/server';
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
      return NextResponse.json(
        { success: false, error: 'Missing outputModeId or params' },
        { status: 400 }
      );
    }

    const scoringContext = await buildOutputModeScoringContext(outputModeId, params);

    return NextResponse.json({
      success: true,
      data: scoringContext ?? { multipliers: {}, defaultMultiplier: 1 },
    });
  } catch (error) {
    const payload = toAppErrorPayload(error, {
      code: 'unknown_error',
      message: 'Failed to build scoring context',
      status: 500,
      retryable: true,
    });

    return NextResponse.json(
      { success: false, error: payload.message },
      { status: payload.status ?? 500 }
    );
  }
}
