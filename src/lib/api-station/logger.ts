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
  [key: string]: any;
}

// 日志格式化
function formatLog(
  level: LogLevel,
  message: string,
  context?: LogContext
): string {
  const timestamp = new Date().toISOString();
  const contextStr = context ? ` ${JSON.stringify(context)}` : '';
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

export function logError(message: string, error?: any, context?: LogContext) {
  const errorStr = error ? ` Error: ${error.message || error}` : '';
  console.error(formatLog(LogLevel.ERROR, message + errorStr, context));
}

// 生成请求 ID
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
