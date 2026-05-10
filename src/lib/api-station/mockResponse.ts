import { logInfo, LogContext } from './logger';

// OpenAI 兼容的响应格式
export interface OpenAIChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string;
    };
    finish_reason: 'stop' | 'length' | 'content_filter';
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// OpenAI 兼容的错误响应格式
export interface OpenAIErrorResponse {
  error: {
    message: string;
    type: string;
    code?: string;
  };
}

/**
 * 创建 Mock 响应
 * @param modelId - 模型 ID
 * @param userMessage - 用户消息
 * @param context - 日志上下文
 * @returns OpenAI 兼容的响应
 */
export function createMockResponse(
  modelId: string,
  userMessage: string,
  context?: LogContext
): OpenAIChatCompletionResponse {
  const responseId = `chatcmpl-mock-${Date.now()}`;
  const timestamp = Math.floor(Date.now() / 1000);

  // 先生成内容
  const content = generateMockContent(modelId, userMessage);

  // 计算 token 数
  const promptTokens = estimateTokens(userMessage);
  const completionTokens = estimateTokens(content);

  const response: OpenAIChatCompletionResponse = {
    id: responseId,
    object: 'chat.completion',
    created: timestamp,
    model: modelId,
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: content
        },
        finish_reason: 'stop'
      }
    ],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens
    }
  };

  logInfo('[MockResponse] 生成 Mock 响应', {
    responseId,
    modelId,
    usage: response.usage,
    ...context
  });

  return response;
}

/**
 * 生成 Mock 内容
 */
function generateMockContent(modelId: string, userMessage: string): string {
  const messagePreview =
    userMessage.length > 50
      ? userMessage.substring(0, 50) + '...'
      : userMessage;

  return `[Mock Response - API 站模块]\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📋 请求信息\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `模型: ${modelId}\n` +
    `消息: ${messagePreview}\n` +
    `\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `ℹ️  状态说明\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `✅ 请求已成功接收\n` +
    `✅ 鉴权已通过\n` +
    `✅ 限流检查已通过\n` +
    `✅ Hook 预处理已完成\n` +
    `\n` +
    `⚠️  注意\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `这是一个 Mock 响应，用于验证 API 站模块功能。\n` +
    `实际的模型调用将在代理模块中实现。\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
}

/**
 * 估算 Token 数量（简化版，仅用于 Mock）
 */
function estimateTokens(text: string): number {
  // 简单估算：约 4 个字符 = 1 个 token（英文）或 2 个字符 = 1 个 token（中文）
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars / 2) + Math.ceil(otherChars / 4);
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
