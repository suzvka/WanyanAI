import { NextRequest, NextResponse } from 'next/server';
import { stationRegistry } from '@/stations/registry';
import { initializeStations } from '@/stations/loader';
import { validateAdminSession } from '@/app/api/v1/admin/guard';

/**
 * PUT /api/v1/admin/toggles
 *
 * 更新指定子站的模型启停状态。
 *
 * Body:
 * {
 *   "stationId": "coze-internal",
 *   "modelId": "coze://deepseek-v3-2-251201",
 *   "enabled": true
 * }
 */
export async function PUT(request: NextRequest) {
  const session = await validateAdminSession();
  if (!session.valid) {
    return session.response;
  }

  try {
    const body = await request.json();
    const { stationId, modelId, enabled } = body as {
      stationId?: string;
      modelId?: string;
      enabled?: boolean;
    };

    if (!stationId || !modelId || typeof enabled !== 'boolean') {
      return NextResponse.json(
        {
          error: 'Missing or invalid fields: stationId (string), modelId (string), enabled (boolean)',
          code: 'INVALID_REQUEST',
        },
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

    if (!station.hasModelToggle) {
      return NextResponse.json(
        { error: `Station ${stationId} does not support model toggles`, code: 'NOT_SUPPORTED' },
        { status: 400 },
      );
    }

    await station.updateModelToggle(modelId, enabled);

    return NextResponse.json({ success: true, stationId, modelId, enabled });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update toggle', code: 'UPDATE_FAILED' },
      { status: 500 },
    );
  }
}