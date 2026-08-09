import { stationRegistry } from '@/stations/registry';
import { initializeStations } from '@/stations/loader';
import { resolvePermission } from '@/lib/api-station/permissionClient';
import { GUEST_PERMISSION_LEVEL } from '@/types/apiStationAuth';
import { logInfo, logError, logWarn, generateRequestId } from '@/lib/api-station/logger';
import { validateRequestKey } from '@/app/api/v1/guard';

/**
 * GET /api/v1/models
 * 获取当前请求者可见的模型列表。
 *
 * 模型列表来自所有已注册的中转站，并按请求者权限等级过滤
 * （子站声明的 minPermissionLevel 高于请求者权限的模型不可见）。
 * Key 格式验证在 /api/v1 统一守卫中执行。
 */
export async function GET(request: Request) {
  const requestId = generateRequestId();

  try {
    // === Key 格式验证（统一守卫）===
    const keyResult = validateRequestKey(request, requestId);
    if (!keyResult.valid) {
      logWarn('[API:Models] Key 格式验证未通过', { requestId });
      return keyResult.errorResponse;
    }

    // 确保中转站已初始化（幂等操作）
    initializeStations();

    // === 权限解析：用于过滤不可见的高门槛模型 ===
    const permissionResult = await resolvePermission(keyResult.key);
    const permissionLevel = permissionResult.permissionLevel;

    logInfo('[API:Models] 收到模型列表请求', {
      requestId,
      permissionLevel,
    });

    // 从所有中转站获取模型列表，过滤掉权限不达标的模型（未声明门槛 = 全开放）
    const allModels = await stationRegistry.getAllModels();
    const visibleModels = allModels.filter(
      m => permissionLevel >= (m.minPermissionLevel ?? GUEST_PERMISSION_LEVEL),
    );

    logInfo('[API:Models] 返回模型列表', {
      requestId,
      totalModels: visibleModels.length,
      filteredCount: allModels.length - visibleModels.length,
      stationCount: stationRegistry.getStations().length,
    });

    const response = {
      object: 'list',
      data: visibleModels.map(model => ({
        id: model.id,
        name: model.name || model.id,
        description: model.description,
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: 'station',
      })),
    };

    return Response.json(response, {
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    logError('[API:Models] 请求处理失败', error, { requestId });

    return Response.json(
      {
        error: {
          message: 'Internal server error',
          type: 'api_error',
        },
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  }
}
