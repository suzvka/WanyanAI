import { NextRequest, NextResponse } from 'next/server';
import { getAvailableModels } from '@/lib/api-station/forwardConfig';
import { authenticateBrowser } from '@/lib/api-station/auth';
import { extractAuthToken } from '@/lib/api-station/authExtractor';
import { logInfo, logError } from '@/lib/api-station/logger';

/**
 * GET /api/v1/models
 * 获取可用模型列表（只返回配置了转发的模型，根据用户权限过滤）
 */
export async function GET(request: NextRequest) {
  const requestId = `models_${Date.now()}`;

  try {
    // 1. 提取认证信息（支持 Authorization: Bearer xxx 和 X-Browser-Id）
    const authToken = extractAuthToken(request);

    logInfo('[API:Models] 收到模型列表请求', {
      requestId,
      authToken: authToken || 'not_provided'
    });

    // 2. 鉴权（认证信息可选，如果未提供则视为游客）
    let permissionLevel = 1; // 默认游客权限

    if (authToken) {
      const authResult = authenticateBrowser(authToken);
      if (!authResult.success) {
        logError('[API:Models] 鉴权失败', authResult.error, { requestId });
        return NextResponse.json(
          {
            error: {
              message: authResult.error,
              type: 'authentication_error',
              code: authResult.errorCode
            }
          },
          { status: 401 }
        );
      }
      permissionLevel = authResult.permissionLevel!;
    }

    logInfo('[API:Models] 鉴权成功', {
      requestId,
      permissionLevel
    });

    // 3. 获取可用模型列表（已过滤权限）
    const availableModels = getAvailableModels(permissionLevel);

    logInfo('[API:Models] 返回模型列表', {
      requestId,
      availableModels: availableModels.length
    });

    // 4. 返回 OpenAI 格式的模型列表
    const response = {
      object: 'list',
      data: availableModels.map(model => ({
        id: model.id,
        name: model.displayName,
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: 'api-station'
      }))
    };

    return NextResponse.json(response);
  } catch (error) {
    logError('[API:Models] 请求处理失败', error, { requestId });

    return NextResponse.json(
      {
        error: {
          message: 'Internal server error',
          type: 'api_error'
        }
      },
      { status: 500 }
    );
  }
}
