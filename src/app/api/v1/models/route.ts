import { getAvailableModels } from '@/lib/api-station/forwardConfig';
import { authenticateProxyKey } from '@/lib/api-station/auth';
import { extractProxyKey } from '@/lib/api-station/authExtractor';
import { logInfo, logError } from '@/lib/api-station/logger';

function toSubjectPreview(subjectId: string | undefined): string {
  return subjectId ? `${subjectId.slice(0, 8)}...` : 'not_provided';
}

/**
 * GET /api/v1/models
 * 获取当前 proxy key 可用的模型列表。
 */
export async function GET(request: Request) {
  const requestId = `models_${Date.now()}`;

  try {
    const proxyKey = extractProxyKey(request);

    logInfo('[API:Models] 收到模型列表请求', {
      requestId,
      hasProxyKey: Boolean(proxyKey),
    });

    const authResult = await authenticateProxyKey(proxyKey, request);
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
    const subjectId = authResult.subjectId!;

    logInfo('[API:Models] 鉴权成功', {
      requestId,
      subjectType: authResult.subjectType,
      subjectPreview: toSubjectPreview(subjectId),
      permissionLevel,
    });

    const availableModels = getAvailableModels(permissionLevel);

    logInfo('[API:Models] 返回模型列表', {
      requestId,
      subjectType: authResult.subjectType,
      subjectPreview: toSubjectPreview(subjectId),
      availableModels: availableModels.length,
    });

    const response = {
      object: 'list',
      data: availableModels.map(model => ({
        id: model.id,
        name: model.id,
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: 'api-station',
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
