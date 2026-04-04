import { NextRequest, NextResponse } from 'next/server';
import { authenticateProxyKey } from '@/lib/api-station/auth';
import { extractChallengeHeaders, extractProxyKey } from '@/lib/api-station/authExtractor';
import { verifyChallengeIfPresent } from '@/lib/api-station/challenge';
import { checkRateLimit } from '@/lib/api-station/rateLimit';
import { getModelConfig, getForwardMapping } from '@/lib/api-station/forwardConfig';
import { executeHooks, HookContext } from '@/lib/api-station/hooks';
import { createErrorResponse } from '@/lib/api-station/mockResponse';
import { logInfo, logWarn, logError, generateRequestId } from '@/lib/api-station/logger';
import { modelConfigProvider } from '@/services/modelConfig/provider';

function toUserRefPreview(userRef: string): string {
    return `${userRef.slice(0, 8)}...`;
}

/**
 * POST /api/v1/chat/completions
 * 接收 OpenAI 格式请求，转发到配置的目标服务。
 */
export async function POST(request: NextRequest) {
    const requestId = generateRequestId();

    try {
        logInfo('[API:Chat] 收到聊天补全请求', { requestId });

        const proxyKey = extractProxyKey(request);
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
            hasProxyKey: Boolean(proxyKey),
            model,
            messageCount: messages?.length || 0,
            stream,
        });

        logInfo('[API:Chat] 开始鉴权', { requestId });
        const authResult = await authenticateProxyKey(proxyKey);

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

        const modelConfig = getModelConfig(model);

        if (!modelConfig) {
            logError('[API:Chat] 模型不存在', null, { requestId, model });
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

        if (permissionLevel < modelConfig.minPermissionLevel) {
            logWarn('[API:Chat] 权限不足', {
                requestId,
                userRefPreview: toUserRefPreview(authenticatedUserRef),
                model,
                userLevel: permissionLevel,
                requiredLevel: modelConfig.minPermissionLevel,
            });
            return NextResponse.json(
                createErrorResponse(
                    `Insufficient permission for model: ${model}`,
                    'permission_denied',
                    'INSUFFICIENT_PERMISSION',
                    { requestId },
                ),
                { status: 403 },
            );
        }

        const forwardMapping = getForwardMapping(model);

        if (!forwardMapping) {
            logError('[API:Chat] 模型未配置转发', null, { requestId, model });
            return NextResponse.json(
                createErrorResponse(
                    `Model not configured for forwarding: ${model}`,
                    'invalid_request_error',
                    'FORWARD_NOT_CONFIGURED',
                    { requestId },
                ),
                { status: 404 },
            );
        }

        logInfo('[API:Chat] 模型验证通过', {
            requestId,
            model,
        });

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

        logInfo('[API:Chat] 开始转发请求', {
            requestId,
            model,
            targetModel: forwardMapping.targetModel,
            stream,
        });

        const result = await modelConfigProvider.chatCompletions(
            forwardMapping.targetBaseUrl,
            forwardMapping.targetApiKey,
            {
                model: forwardMapping.targetModel,
                messages,
                stream,
                ...otherParams,
            },
        );

        if (!result.success) {
            logError('[API:Chat] 转发请求失败', result.error, { requestId, model });
            return NextResponse.json(
                createErrorResponse(
                    result.error?.message || 'Forwarding failed',
                    result.error?.code || 'forward_error',
                    undefined,
                    { requestId },
                ),
                { status: result.error?.status || 500 },
            );
        }

        logInfo('[API:Chat] 转发请求成功', { requestId, model, stream });

        const rateLimitHeaders: Record<string, string> = {};
        if (rateLimitResult.quota) {
            rateLimitHeaders['X-RateLimit-Limit'] = rateLimitResult.quota.limit.toString();
            rateLimitHeaders['X-RateLimit-Remaining'] = rateLimitResult.quota.remaining.toString();
            rateLimitHeaders['X-RateLimit-Reset'] = rateLimitResult.quota.reset.toString();
        }

        if (stream && result.response) {
            return new Response(result.response.body, {
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                    ...rateLimitHeaders,
                },
            });
        }

        const data = await result.response!.json();
        return NextResponse.json(data, { headers: rateLimitHeaders });
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
