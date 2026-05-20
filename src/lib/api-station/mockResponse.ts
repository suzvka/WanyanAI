import { logInfo, LogContext } from './logger';

// OpenAI 兼容的错误响应格式
export interface OpenAIErrorResponse {
  error: {
    message: string;
    type: string;
    code?: string;
  };
}

/**
 * 创建 OpenAI 格式的错误响应
 */
export function createErrorResponse(
  message: string,
  type: string = 'api_error',
  code?: string,
  context?: LogContext
): OpenAIErrorResponse {
  const errorResponse: OpenAIErrorResponse = {
    error: {
      message,
      type,
      ...(code && { code })
    }
  };

  logInfo('[MockResponse] 生成错误响应', {
    errorType: type,
    errorCode: code,
    ...context
  });

  return errorResponse;
}
