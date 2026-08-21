import { NextResponse } from 'next/server';
import { stationRegistry } from '@/stations/registry';
import { initializeStations } from '@/stations/loader';
import { validateAdminSession } from '@/app/api/v1/admin/guard';

/**
 * GET /api/v1/admin/stations
 *
 * 列出所有接受 Admin 管理的子站及其配置信息。
 */
export async function GET() {
  const session = await validateAdminSession();
  if (!session.valid) {
    return session.response;
  }

  // 确保中转站已初始化
  initializeStations();

  const managedStations = stationRegistry.getAdminManagedStations();

  const stationsData = await Promise.all(
    managedStations.map(async (s) => ({
      id: s.id,
      name: s.name,
      hasCredentialConfig: s.hasCredentialConfig,
      hasModelToggle: s.hasModelToggle,
      credentialSchema: s.hasCredentialConfig ? await s.getCredentialSchema() : [],
      credentials: s.hasCredentialConfig ? await s.getCredentialConfig() : [],
      modelToggles: s.hasModelToggle ? await s.getModelToggles() : [],
    })),
  );

  return NextResponse.json({
    stations: stationsData,
    total: stationsData.length,
  });
}