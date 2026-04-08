// 日志级别
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

// 日志上下文
export interface LogContext {
  browserId?: string;
  modelId?: string;
  requestId?: string;
  [key: string]: unknown;
}

const SENSITIVE_KEY_PATTERN = /authorization|api[_-]?key|proxy[_-]?key|proof|token|secret|password|prompt|message|content|response|expected|received|modifiedData|userRef/i;

function sanitizeValue(key: string, value: unknown): unknown {
  if (value == null) {
    return value;
  }

  if (SENSITIVE_KEY_PATTERN.test(key)) {
    return '[REDACTED]';
  }

  if (Array.isArray(value)) {
    return `[array:${value.length}]`;
  }

  if (typeof value === 'object') {
    return sanitizeContext(value as LogContext);
  }

  if (typeof value === 'string' && value.length > 160) {
    return `${value.slice(0, 32)}...[TRUNCATED:${value.length}]`;
  }

  return value;
}

function sanitizeContext(context: LogContext): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => [key, sanitizeValue(key, value)]),
  );
}

// 日志格式化
function formatLog(
  level: LogLevel,
  message: string,
  context?: LogContext
): string {
  const timestamp = new Date().toISOString();
  const contextStr = context ? ` ${JSON.stringify(sanitizeContext(context))}` : '';
  return `[${timestamp}] [${level}] ${message}${contextStr}`;
}

// 日志函数
export function logDebug(message: string, context?: LogContext) {
  console.log(formatLog(LogLevel.DEBUG, message, context));
}

export function logInfo(message: string, context?: LogContext) {
  console.log(formatLog(LogLevel.INFO, message, context));
}

export function logWarn(message: string, context?: LogContext) {
  console.warn(formatLog(LogLevel.WARN, message, context));
}

export function logError(message: string, error?: unknown, context?: LogContext) {
  const errorStr = error
    ? ` Error: ${error instanceof Error ? error.message : String(error)}`
    : '';
  console.error(formatLog(LogLevel.ERROR, message + errorStr, context));
}

// 生成请求 ID
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
