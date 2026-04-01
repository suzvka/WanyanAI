import { NextRequest, NextResponse } from 'next/server';
import { authenticateBrowser } from '@/lib/api-station/auth';
import { extractAuthToken } from '@/lib/api-station/authExtractor';
import { checkRateLimit } from '@/lib/api-station/rateLimit';
import { getModelConfig, getForwardMapping } from '@/lib/api-station/forwardConfig';
import { executeHooks, HookContext } from '@/lib/api-station/hooks';
import { createErrorResponse } from '@/lib/api-station/mockResponse';
import { logInfo, logWarn, logError, generateRequestId } from '@/lib/api-station/logger';
import { modelConfigProvider } from '@/services/modelConfig/provider';

/**
 * POST /api/v1/chat/completions
 * 接收 OpenAI 格式请求，转发到配置的目标服务
 */
export async function POST(request: NextRequest) {
  const requestId = generateRequestId();

  try {
    logInfo('[API:Chat] 收到聊天补全请求', { requestId });

    // 1. 提取认证信息（支持 Authorization: Bearer xxx 和 X-Browser-Id）
    const authToken = extractAuthToken(request);

    if (!authToken) {
      logError('[API:Chat] 认证信息缺失', null, { requestId });
      return NextResponse.json(
        createErrorResponse(
          'Missing authentication. Please provide Authorization: Bearer <token> or X-Browser-Id header.',
          'authentication_error',
          'MISSING_AUTH_TOKEN',
          { requestId }
        ),
        { status: 401 }
      );
    }

    // 2. 解析请求体
    const requestBody = await request.json();

    const {
      model,
      messages,
      stream = false,
      ...otherParams
    } = requestBody;

    logInfo('[API:Chat] 请求参数解析', {
      requestId,
      authToken: authToken.substring(0, 8) + '...',
      model,
      messageCount: messages?.length || 0,
      stream
    });

    // 3. 鉴权
    logInfo('[API:Chat] 开始鉴权', { requestId, authToken: authToken.substring(0, 8) + '...' });
    const authResult = authenticateBrowser(authToken);

    if (!authResult.success) {
      logError('[API:Chat] 鉴权失败', authResult.error, { requestId, authToken: authToken.substring(0, 8) + '...' });
      return NextResponse.json(
        createErrorResponse(
          authResult.error!,
          'authentication_error',
          authResult.errorCode,
          { requestId }
        ),
        { status: 401 }
      );
    }

    const permissionLevel = authResult.permissionLevel!;

    logInfo('[API:Chat] 鉴权成功', {
      requestId,
      authToken: authToken.substring(0, 8) + '...',
      permissionLevel
    });

    // 4. 限流检查
    logInfo('[API:Chat] 开始限流检查', { requestId, authToken: authToken.substring(0, 8) + '...' });
    const rateLimitResult = checkRateLimit(authToken);

    if (!rateLimitResult.allowed) {
      logWarn('[API:Chat] 限流触发', {
        requestId,
        authToken: authToken.substring(0, 8) + '...',
        reason: rateLimitResult.reason
      });
      return NextResponse.json(
        createErrorResponse(
          rateLimitResult.reason!,
          'rate_limit_error',
          rateLimitResult.errorCode,
          { requestId }
        ),
        { status: 429 }
      );
    }

    logInfo('[API:Chat] 限流检查通过', { requestId, authToken: authToken.substring(0, 8) + '...' });

    // 5. 验证模型
    if (!model) {
      logError('[API:Chat] 模型 ID 缺失', null, { requestId });
      return NextResponse.json(
        createErrorResponse(
          'Missing required field: model',
          'invalid_request_error',
          'MISSING_MODEL',
          { requestId }
        ),
        { status: 400 }
      );
    }

    const modelConfig = getModelConfig(model);

    if (!modelConfig) {
      logError('[API:Chat] 模型不存在', null, { requestId, model });
      return NextResponse.json(
        createErrorResponse(
          `Model not found: ${model}`,
          'invalid_request_error',
          'MODEL_NOT_FOUND',
          { requestId }
        ),
        { status: 404 }
      );
    }

    // 6. 检查模型权限
    if (permissionLevel < modelConfig.minPermissionLevel) {
      logWarn('[API:Chat] 权限不足', {
        requestId,
        authToken: authToken.substring(0, 8) + '...',
        model,
        userLevel: permissionLevel,
        requiredLevel: modelConfig.minPermissionLevel
      });
      return NextResponse.json(
        createErrorResponse(
          `Insufficient permission for model: ${model}`,
          'permission_denied',
          'INSUFFICIENT_PERMISSION',
          { requestId }
        ),
        { status: 403 }
      );
    }

    // 7. 查找转发配置
    const forwardMapping = getForwardMapping(model);

    if (!forwardMapping) {
      logError('[API:Chat] 模型未配置转发', null, { requestId, model });
      return NextResponse.json(
        createErrorResponse(
          `Model not configured for forwarding: ${model}`,
          'invalid_request_error',
          'FORWARD_NOT_CONFIGURED',
          { requestId }
        ),
        { status: 404 }
      );
    }

    logInfo('[API:Chat] 模型验证通过', {
      requestId,
      model,
      forwardTo: forwardMapping.targetBaseUrl
    });

    // 8. 准备 Hook 上下文
    const hookContext: HookContext = {
      request: {
        browserId: authToken,
        modelId: model,
        messages: messages || [],
        parameters: otherParams
      },
      metadata: {
        requestId,
        timestamp: Date.now(),
        permissionLevel
      }
    };

    // 9. 执行 Hook 预处理
    logInfo('[API:Chat] 开始执行 Hook 预处理', { requestId });
    const hookResult = await executeHooks(hookContext);

    if (hookResult.action === 'block') {
      logWarn('[API:Chat] Hook 阻止了请求', {
        requestId,
        hookReason: hookResult.error
      });
      return NextResponse.json(
        createErrorResponse(
          hookResult.error || 'Request blocked by hook',
          'blocked_by_hook',
          'REQUEST_BLOCKED',
          { requestId }
        ),
        { status: 403 }
      );
    }

    if (hookResult.action === 'modify') {
      logInfo('[API:Chat] Hook 修改了请求', {
        requestId,
        modifiedData: hookResult.data
      });
    }

    logInfo('[API:Chat] Hook 预处理完成', { requestId });

    // 10. 转发请求
    logInfo('[API:Chat] 开始转发请求', {
      requestId,
      model,
      targetBaseUrl: forwardMapping.targetBaseUrl,
      stream
    });

    const result = await modelConfigProvider.chatCompletions(
      forwardMapping.targetBaseUrl,
      forwardMapping.targetApiKey,
      {
        model,
        messages,
        stream,
        ...otherParams
      }
    );

    if (!result.success) {
      logError('[API:Chat] 转发请求失败', result.error, { requestId, model });
      return NextResponse.json(
        createErrorResponse(
          result.error?.message || 'Forwarding failed',
          result.error?.code || 'forward_error',
          undefined,
          { requestId }
        ),
        { status: result.error?.status || 500 }
      );
    }

    logInfo('[API:Chat] 转发请求成功', { requestId, model, stream });

    // 11. 返回响应（支持流式和非流式）
    if (stream && result.response) {
      // 流式响应：透传 SSE 流
      return new Response(result.response.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } else {
      // 非流式响应：透传 JSON
      const data = await result.response!.json();
      return NextResponse.json(data);
    }

  } catch (error) {
    logError('[API:Chat] 请求处理失败', error, { requestId });

    // 如果是 JSON 解析错误
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid JSON in request body',
          'invalid_request_error',
          'INVALID_JSON',
          { requestId }
        ),
        { status: 400 }
      );
    }

    return NextResponse.json(
      createErrorResponse(
        'Internal server error',
        'api_error',
        undefined,
        { requestId }
      ),
      { status: 500 }
    );
  }
}
