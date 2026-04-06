import { NextRequest, NextResponse } from 'next/server';
import { validateOutputModeData } from '@/server/output-modes';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { outputModeId, data } = body as {
      outputModeId: string;
      data: unknown;
    };

    if (!outputModeId || data === undefined) {
      return NextResponse.json(
        { success: false, errors: [{ path: '', message: 'Missing required parameters' }] },
        { status: 400 }
      );
    }

    const result = await validateOutputModeData(outputModeId, data);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] validate error:', error);
    return NextResponse.json(
      { success: false, errors: [{ path: '', message: error instanceof Error ? error.message : 'Unknown error' }] },
      { status: 500 }
    );
  }
}
