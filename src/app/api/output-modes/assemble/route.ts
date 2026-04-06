import { NextRequest, NextResponse } from 'next/server';
import { assembleOutputModeData } from '@/server/output-modes';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { outputModeId, collectedData } = body as {
      outputModeId: string;
      collectedData: Record<string, unknown[]>;
    };

    if (!outputModeId || !collectedData) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const result = await assembleOutputModeData(outputModeId, collectedData);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] assemble error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
