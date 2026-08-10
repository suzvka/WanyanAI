import { NextRequest, NextResponse } from 'next/server';
import { stationRegistry } from '@/stations/registry';
import { initializeStations } from '@/stations/loader';
import { validateAdminSession } from '@/app/api/v1/admin/guard';

/**
 * PUT /api/v1/admin/config
 *
 * 更新指定子站的凭证配置。
 *
 * Body:
 * {
 *   "stationId": "openai-forward",
 *   "credentials": [ ... ]  // CredentialField 数组
 * }
 */
export async function PUT(request: NextRequest) {
  const session = await validateAdminSession();
  if (!session.valid) {
    return session.response;
  }

  try {
    const body = await request.json();
    const { stationId, credentials } = body as {
      stationId?: string;
      credentials?: unknown[];
    };

    if (!stationId || !Array.isArray(credentials)) {
      return NextResponse.json(
        { error: 'Missing or invalid fields: stationId (string), credentials (array)', code: 'INVALID_REQUEST' },
        { status: 400 },
      );
    }

    // 确保中转站已初始化
    initializeStations();

    const managedStations = stationRegistry.getAdminManagedStations();
    const station = managedStations.find(s => s.id === stationId);

    if (!station) {
      return NextResponse.json(
        { error: `Station not found or not manageable: ${stationId}`, code: 'STATION_NOT_FOUND' },
        { status: 404 },
      );
    }

    if (!station.hasCredentialConfig) {
      return NextResponse.json(
        { error: `Station ${stationId} does not support credential config`, code: 'NOT_SUPPORTED' },
        { status: 400 },
      );
    }

    await station.updateCredentialConfig(credentials as any);

    return NextResponse.json({ success: true, stationId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update config', code: 'UPDATE_FAILED' },
      { status: 500 },
    );
  }
}