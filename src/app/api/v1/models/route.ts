import { stationRegistry, initializeStations } from '@/stations';
import { authenticate, extractKey } from '@/lib/api-station/auth';
import { logInfo, logError } from '@/lib/api-station/logger';

function toKeyPreview(key: string | undefined): string {
  return key ? `${key.slice(0, 8)}...` : 'not_provided';
}

/**
 * GET /api/v1/models
 * 获取当前 key 可用的模型列表。
 *
 * 模型列表来自所有已注册的中转站。
 */
export async function GET(request: Request) {
  const requestId = `models_${Date.now()}`;

  try {
    // 确保中转站已初始化（幂等操作）
    initializeStations();

    logInfo('[API:Models] 收到模型列表请求', {
      requestId,
      hasKey: Boolean(extractKey(request)),
    });

    // === 鉴权 ===
    const authResult = await authenticate(request);
    if (!authResult.success) {
      logError('[API:Models] 鉴权失败', authResult.error, { requestId });
      return Response.json(
        {
          error: {
            message: authResult.error,
            type: 'authentication_error',
            code: authResult.errorCode,
          },
        },
        {
          status: 401,
          headers: {
            'Cache-Control': 'no-store',
          },
        },
      );
    }

    const permissionLevel = authResult.permissionLevel!;
    const key = authResult.key!;

    logInfo('[API:Models] 鉴权成功', {
      requestId,
      keyPreview: toKeyPreview(key),
      permissionLevel,
      source: authResult.source,
    });

    // 从所有中转站获取模型列表
    const allModels = await stationRegistry.getAllModels();

    // 权限过滤（目前所有模型都要求 permissionLevel >= 1）
    const availableModels = allModels.filter(model => {
      return permissionLevel >= 1;
    });

    logInfo('[API:Models] 返回模型列表', {
      requestId,
      keyPreview: toKeyPreview(key),
      availableModels: availableModels.length,
      stationCount: stationRegistry.getStations().length,
    });

    const response = {
      object: 'list',
      data: availableModels.map(model => ({
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
