import { NextRequest, NextResponse } from 'next/server';
import { authenticate, extractKey } from '@/lib/api-station/auth';
import { checkRateLimit } from '@/lib/api-station/rateLimit';
import { executeHooks, HookContext } from '@/lib/api-station/hooks';
import { createErrorResponse } from '@/lib/api-station/mockResponse';
import { logInfo, logError, generateRequestId } from '@/lib/api-station/logger';
import { stationRegistry, initializeStations } from '@/stations';

function toKeyPreview(key: string | undefined): string {
  return key ? `${key.slice(0, 8)}...` : 'not_provided';
}

/**
 * POST /api/v1/chat/completions
 *
 * 接收 OpenAI 格式请求，通过中转站转发到目标服务。
 *
 * 流程：
 * 1. 鉴权（格式校验 + 限流 + 认证服务验证）→ 2. 查找中转站 → 3. 转发请求
 */
export async function POST(request: NextRequest) {
  const requestId = generateRequestId();

  // 确保中转站已初始化（幂等操作）
  initializeStations();

  try {
    logInfo('[API:Chat] 收到聊天补全请求', { requestId });

    const requestBody = await request.json();

    const {
      model,
      messages,
      stream = false,
      ...otherParams
    } = requestBody;

    logInfo('[API:Chat] 请求参数解析', {
      requestId,
      hasKey: Boolean(extractKey(request)),
      model,
      messageCount: messages?.length || 0,
      stream,
    });

    // === 鉴权 ===
    logInfo('[API:Chat] 开始鉴权', { requestId });
    const authResult = await authenticate(request);

    if (!authResult.success) {
      logError('[API:Chat] 认证失败', authResult.error, { requestId });
      return NextResponse.json(
        createErrorResponse(
          authResult.error!,
          'authentication_error',
          authResult.errorCode,
          { requestId },
        ),
        { status: 401 },
      );
    }

    const permissionLevel = authResult.permissionLevel!;
    const key = authResult.key!;

    logInfo('[API:Chat] 认证成功', {
      requestId,
      keyPreview: toKeyPreview(key),
      permissionLevel,
      source: authResult.source,
    });

    // === 模型验证 ===
    if (!model) {
      logError('[API:Chat] 模型 ID 缺失', null, { requestId });
      return NextResponse.json(
        createErrorResponse(
          'Missing required field: model',
          'invalid_request_error',
          'MISSING_MODEL',
          { requestId },
        ),
        { status: 400 },
      );
    }

    // === 查找中转站 ===
    const station = stationRegistry.findStation(model);

    if (!station) {
      logError('[API:Chat] 未找到可处理该模型的中转站', null, { requestId, model });
      return NextResponse.json(
        createErrorResponse(
          `Model not found: ${model}`,
          'invalid_request_error',
          'MODEL_NOT_FOUND',
          { requestId },
        ),
        { status: 404 },
      );
    }

    logInfo('[API:Chat] 找到中转站', {
      requestId,
      model,
      stationId: station.id,
      stationName: station.name,
      stream,
    });

    // === Hook 预处理 ===
    const hookContext: HookContext = {
      request: {
        browserId: key,
        modelId: model,
        messages: messages || [],
        parameters: otherParams,
      },
      metadata: {
        requestId,
        timestamp: Date.now(),
        permissionLevel,
      },
    };

    logInfo('[API:Chat] 开始执行 Hook 预处理', { requestId });
    const hookResult = await executeHooks(hookContext);

    if (hookResult.action === 'block') {
      logError('[API:Chat] Hook 阻止了请求', null, {
        requestId,
        hookReason: hookResult.error,
      });
      return NextResponse.json(
        createErrorResponse(
          hookResult.error || 'Request blocked by hook',
          'blocked_by_hook',
          'REQUEST_BLOCKED',
          { requestId },
        ),
        { status: 403 },
      );
    }

    if (hookResult.action === 'modify') {
      logInfo('[API:Chat] Hook 修改了请求', {
        requestId,
        modified: true,
      });
    }

    logInfo('[API:Chat] Hook 预处理完成', { requestId });

    // === 限流头计算（用于响应）===
    const rateLimitResult = checkRateLimit({ subjectId: key, permissionLevel });
    const rateLimitHeaders: Record<string, string> = {};
    if (rateLimitResult.quota) {
      rateLimitHeaders['X-RateLimit-Limit'] = rateLimitResult.quota.limit.toString();
      rateLimitHeaders['X-RateLimit-Remaining'] = rateLimitResult.quota.remaining.toString();
      rateLimitHeaders['X-RateLimit-Reset'] = rateLimitResult.quota.reset.toString();
    }

    // === 转发请求 ===
    const forwardResponse = await station.forward({
      model,
      messages: messages || [],
      stream,
      ...otherParams,
      headers: request.headers,
      requestId,
    });

    // 构建最终响应
    const responseHeaders = new Headers(forwardResponse.headers);
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      responseHeaders.set(key, value);
    });

    logInfo('[API:Chat] 请求处理完成', { requestId, model, stream });

    return new Response(forwardResponse.body, {
      status: forwardResponse.status,
      headers: responseHeaders,
    });

  } catch (error) {
    logError('[API:Chat] 请求处理失败', error, { requestId });

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        createErrorResponse(
          'Invalid JSON in request body',
          'invalid_request_error',
          'INVALID_JSON',
          { requestId },
        ),
        { status: 400 },
      );
    }

    return NextResponse.json(
      createErrorResponse(
        'Internal server error',
        'api_error',
        undefined,
        { requestId },
      ),
      { status: 500 },
    );
  }
}
