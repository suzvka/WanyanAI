import { stationRegistry } from '@/stations/registry';
import { initializeStations } from '@/stations/loader';
import { logInfo, logError, logWarn, generateRequestId } from '@/lib/api-station/logger';
import { validateRequestKey } from '@/app/api/v1/guard';

/**
 * GET /api/v1/models
 * 获取所有可用模型列表。
 *
 * 模型列表来自所有已注册的中转站。
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

    logInfo('[API:Models] 收到模型列表请求', {
      requestId,
    });

    // 从所有中转站获取模型列表
    const allModels = await stationRegistry.getAllModels();

    logInfo('[API:Models] 返回模型列表', {
      requestId,
      totalModels: allModels.length,
      stationCount: stationRegistry.getStations().length,
    });

    const response = {
      object: 'list',
      data: allModels.map(model => ({
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
