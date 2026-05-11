import { NextRequest, NextResponse } from 'next/server';
import { authenticateUnifiedToken } from '@/lib/api-station/auth';
import { extractChallengeHeaders, extractUnifiedToken } from '@/lib/api-station/authExtractor';
import { verifyChallengeIfPresent } from '@/lib/api-station/challenge';
import { checkRateLimit } from '@/lib/api-station/rateLimit';
import { executeHooks, HookContext } from '@/lib/api-station/hooks';
import { createErrorResponse } from '@/lib/api-station/mockResponse';
import { logInfo, logWarn, logError, generateRequestId } from '@/lib/api-station/logger';
import { stationRegistry, initializeStations } from '@/stations';

function toUserRefPreview(userRef: string): string {
    return `${userRef.slice(0, 8)}...`;
}

/**
 * POST /api/v1/chat/completions
 * 
 * 接收 OpenAI 格式请求，通过中转站转发到目标服务。
 * 
 * 流程：
 * 1. 鉴权 → 2. 限流 → 3. 查找中转站 → 4. 转发请求
 */
export async function POST(request: NextRequest) {
    const requestId = generateRequestId();

    // 确保中转站已初始化（幂等操作）
    initializeStations();

    try {
        logInfo('[API:Chat] 收到聊天补全请求', { requestId });

        const unifiedToken = extractUnifiedToken(request);
        const challengeParams = extractChallengeHeaders(request);
        const requestBody = await request.json();

        const {
            model,
            messages,
            stream = false,
            ...otherParams
        } = requestBody;

        logInfo('[API:Chat] 请求参数解析', {
            requestId,
            hasToken: Boolean(unifiedToken),
            model,
            messageCount: messages?.length || 0,
            stream,
        });

        // === 鉴权 ===
        logInfo('[API:Chat] 开始鉴权', { requestId });
        const authResult = await authenticateUnifiedToken(unifiedToken, request);

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
        const authenticatedUserRef = authResult.userRef!;
        const proof = authResult.proof!;

        logInfo('[API:Chat] 认证成功', {
            requestId,
            userRefPreview: toUserRefPreview(authenticatedUserRef),
            permissionLevel,
        });

        // === Challenge 验证 ===
        const challengeResult = await verifyChallengeIfPresent({
            ...challengeParams,
            proof,
            userRef: authenticatedUserRef,
        });

        if (!challengeResult.success) {
            logWarn('[API:Chat] 辅助防刷 challenge 验证失败', {
                requestId,
                userRefPreview: toUserRefPreview(authenticatedUserRef),
                errorCode: challengeResult.errorCode,
            });
            return NextResponse.json(
                createErrorResponse(
                    challengeResult.error || 'Challenge verification failed',
                    'authentication_error',
                    challengeResult.errorCode,
                    { requestId },
                ),
                { status: 401 },
            );
        }

        if (!challengeResult.skipped) {
            logInfo('[API:Chat] 辅助防刷 challenge 验证通过', {
                requestId,
                userRefPreview: toUserRefPreview(authenticatedUserRef),
            });
        }

        // === 限流检查 ===
        logInfo('[API:Chat] 开始限流检查', { requestId, permissionLevel });
        const rateLimitResult = checkRateLimit({
            subjectId: authenticatedUserRef,
            permissionLevel,
        });

        if (!rateLimitResult.allowed) {
            logWarn('[API:Chat] 限流触发', {
                requestId,
                userRefPreview: toUserRefPreview(authenticatedUserRef),
                reason: rateLimitResult.reason,
                retryAfter: rateLimitResult.retryAfter,
            });

            const errorData: {
                message: string;
                type: string;
                code: string | undefined;
                requestId: string;
                retryAfter?: number;
            } = {
                message: rateLimitResult.reason!,
                type: 'rate_limit_error',
                code: rateLimitResult.errorCode,
                requestId,
            };

            if (rateLimitResult.retryAfter) {
                errorData.retryAfter = rateLimitResult.retryAfter;
            }

            const headers: Record<string, string> = {};
            if (rateLimitResult.retryAfter) {
                headers['Retry-After'] = rateLimitResult.retryAfter.toString();
            }
            if (rateLimitResult.quota) {
                headers['X-RateLimit-Limit'] = rateLimitResult.quota.limit.toString();
                headers['X-RateLimit-Remaining'] = rateLimitResult.quota.remaining.toString();
                headers['X-RateLimit-Reset'] = rateLimitResult.quota.reset.toString();
            }

            return NextResponse.json({ error: errorData }, { status: 429, headers });
        }

        logInfo('[API:Chat] 限流检查通过', {
            requestId,
            remaining: rateLimitResult.quota?.remaining,
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
                browserId: authenticatedUserRef,
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
            logWarn('[API:Chat] Hook 阻止了请求', {
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

        // === 转发请求 ===
        const forwardResponse = await station.forward({
            model,
            messages: messages || [],
            stream,
            ...otherParams,
            headers: request.headers,
            requestId,
        });

        // 添加限流头
        const rateLimitHeaders: Record<string, string> = {};
        if (rateLimitResult.quota) {
            rateLimitHeaders['X-RateLimit-Limit'] = rateLimitResult.quota.limit.toString();
            rateLimitHeaders['X-RateLimit-Remaining'] = rateLimitResult.quota.remaining.toString();
            rateLimitHeaders['X-RateLimit-Reset'] = rateLimitResult.quota.reset.toString();
        }

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
