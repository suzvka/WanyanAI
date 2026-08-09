import { NextRequest, NextResponse } from 'next/server';
import { resolvePermission } from '@/lib/api-station/permissionClient';
import { checkRateLimit, checkModelRateLimit } from '@/lib/api-station/rateLimit';
import { executeHooks, HookContext } from '@/lib/api-station/hooks';
import { createErrorResponse } from '@/lib/api-station/mockResponse';
import { logInfo, logError, logWarn, generateRequestId } from '@/lib/api-station/logger';
import { stationRegistry } from '@/stations/registry';
import { initializeStations } from '@/stations/loader';
import { validateRequestKey } from '@/app/api/v1/guard';

/**
 * POST /api/v1/chat/completions
 *
 * 接收 OpenAI 格式请求，通过中转站转发到目标服务。
 *
 * 流程：
 * 1. 提取 key → 2. 权限解析（key → 权限等级）→ 3. 模型门槛检查（子站声明、入口裁决）
 * → 4. 限流检查（权限等级级 + 模型级）→ 5. 查找中转站 → 6. 转发请求
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

    // === Key 格式验证（统一守卫）===
    const keyResult = validateRequestKey(request, requestId);
    if (!keyResult.valid) {
      return keyResult.errorResponse;
    }
    const key = keyResult.key;

    logInfo('[API:Chat] 请求参数解析', {
      requestId,
      hasKey: Boolean(key),
      model,
      messageCount: messages?.length || 0,
      stream,
    });

    // === 权限解析：根据 key 查询对应的权限等级 ===
    const permissionResult = await resolvePermission(key);

    const permissionLevel = permissionResult.permissionLevel;

    logInfo('[API:Chat] 权限解析完成', {
      requestId,
      permissionLevel,
      source: permissionResult.source,
      identityId: permissionResult.identityId,
    });

    // === 模型权限门槛检查（子站声明、入口裁决；放在限流前，拒绝时不消耗配额）===
    const modelMeta = await stationRegistry.findModel(model);

    if (!modelMeta) {
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

    if (modelMeta.minPermissionLevel !== undefined && permissionLevel < modelMeta.minPermissionLevel) {
      logWarn('[API:Chat] 模型权限门槛未达标', {
        requestId,
        model,
        permissionLevel,
        minPermissionLevel: modelMeta.minPermissionLevel,
      });
      return NextResponse.json(
        createErrorResponse(
          `Insufficient permission level for model: ${model}`,
          'permission_error',
          'INSUFFICIENT_PERMISSION',
          { requestId },
        ),
        { status: 403 },
      );
    }

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

    // === 模型级限流检查（配额由子站元数据声明）===
    const modelRateLimitResult = checkModelRateLimit(model, modelMeta.maxCallsPerHour);

    if (!modelRateLimitResult.allowed) {
      logWarn('[API:Chat] 模型级限流触发', {
        requestId,
        model,
        reason: modelRateLimitResult.reason,
      });
      const retryAfter = modelRateLimitResult.retryAfter || 60;
      return NextResponse.json(
        createErrorResponse(
          modelRateLimitResult.reason || 'Model rate limit exceeded',
          'rate_limit_error',
          modelRateLimitResult.errorCode || 'MODEL_RATE_LIMIT_EXCEEDED',
          { requestId },
        ),
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfter) },
        },
      );
    }

    // 构建限流响应头（权限等级级与模型级配额取更严格的一方）
    const effectiveQuota =
      (modelRateLimitResult.quota?.remaining ?? Infinity) < (rateLimitResult.quota?.remaining ?? Infinity)
        ? modelRateLimitResult.quota
        : rateLimitResult.quota;
    const rateLimitHeaders: Record<string, string> = {};
    if (effectiveQuota) {
      rateLimitHeaders['X-RateLimit-Limit'] = String(effectiveQuota.limit);
      rateLimitHeaders['X-RateLimit-Remaining'] = String(effectiveQuota.remaining);
      rateLimitHeaders['X-RateLimit-Reset'] = String(effectiveQuota.reset);
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

    // === 转发请求（子站仅负责转发，不参与权限解析和限流）===
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
