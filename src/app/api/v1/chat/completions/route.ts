import { NextRequest, NextResponse } from 'next/server';
import { extractKey } from '@/lib/api-station/auth';
import { verifyKey } from '@/lib/api-station/authClient';
import { checkRateLimit } from '@/lib/api-station/rateLimit';
import { executeHooks, HookContext } from '@/lib/api-station/hooks';
import { createErrorResponse } from '@/lib/api-station/mockResponse';
import { logInfo, logError, logWarn, generateRequestId } from '@/lib/api-station/logger';
import { stationRegistry, initializeStations } from '@/stations';

/**
 * POST /api/v1/chat/completions
 *
 * 接收 OpenAI 格式请求，通过中转站转发到目标服务。
 *
 * 流程：
 * 1. 提取 key → 2. 鉴权（获取权限等级）→ 3. 限流检查 → 4. 查找中转站 → 5. 转发请求
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

    // === 提取 key ===
    const key = extractKey(request);

    logInfo('[API:Chat] 请求参数解析', {
      requestId,
      hasKey: Boolean(key),
      model,
      messageCount: messages?.length || 0,
      stream,
    });

    // === 鉴权：验证 key，获取权限等级 ===
    const verifyResult = await verifyKey(key);

    // key 为空时返回 401
    if (!key) {
      logWarn('[API:Chat] 缺少 Authorization key', { requestId });
      return NextResponse.json(
        createErrorResponse(
          'Missing Authorization header. Please provide a valid API key.',
          'authentication_error',
          'MISSING_API_KEY',
          { requestId },
        ),
        { status: 401 },
      );
    }

    const permissionLevel = verifyResult.permissionLevel;

    logInfo('[API:Chat] 鉴权完成', {
      requestId,
      permissionLevel,
      source: verifyResult.source,
      identityId: verifyResult.identityId,
    });

    // === 限流检查 ===
    const subjectId = `key:${key}`;
    const rateLimitResult = checkRateLimit({ subjectId, permissionLevel });

    if (!rateLimitResult.allowed) {
      logWarn('[API:Chat] 限流触发', {
        requestId,
        subjectId,
        permissionLevel,
        reason: rateLimitResult.reason,
      });
      const retryAfter = rateLimitResult.retryAfter || 60;
      return NextResponse.json(
        createErrorResponse(
          rateLimitResult.reason || 'Rate limit exceeded',
          'rate_limit_error',
          rateLimitResult.errorCode || 'RATE_LIMITED',
          { requestId },
        ),
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfter) },
        },
      );
    }

    // 构建限流响应头
    const rateLimitHeaders: Record<string, string> = {};
    if (rateLimitResult.quota) {
      rateLimitHeaders['X-RateLimit-Limit'] = String(rateLimitResult.quota.limit);
      rateLimitHeaders['X-RateLimit-Remaining'] = String(rateLimitResult.quota.remaining);
      rateLimitHeaders['X-RateLimit-Reset'] = String(rateLimitResult.quota.reset);
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

    // === 转发请求（子站仅负责转发，不参与鉴权限流）===
    const forwardResponse = await station.forward({
      model,
      messages: messages || [],
      stream,
      ...otherParams,
      headers: request.headers,
      requestId,
      authKey: key,
    });

    logInfo('[API:Chat] 请求处理完成', { requestId, model, stream });

    // 合并限流响应头到转发响应
    const mergedHeaders = new Headers(forwardResponse.headers);
    for (const [name, value] of Object.entries(rateLimitHeaders)) {
      mergedHeaders.set(name, value);
    }

    return new Response(forwardResponse.body, {
      status: forwardResponse.status,
      headers: mergedHeaders,
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
