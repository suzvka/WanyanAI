import { NextRequest, NextResponse } from 'next/server';
import { getErrorMessage, outputModeValidationError } from '../_shared';
import { validateOutputModeData } from '@/server/output-modes';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { outputModeId, data } = body as {
      outputModeId: string;
      data: unknown;
    };

    if (!outputModeId || data === undefined) {
      return outputModeValidationError('Missing required parameters', 400);
    }

    const result = await validateOutputModeData(outputModeId, data);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] validate error:', error);
    return outputModeValidationError(getErrorMessage(error), 500);
  }
}
