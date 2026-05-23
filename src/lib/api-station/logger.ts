/**
 * Isomorphic 日志模块 - 自动适配服务端/客户端
 *
 * 特性：
 * - 服务端：使用 Pino，支持美化输出和 JSON 格式
 * - 客户端：使用 console 封装，支持等级过滤
 * - 环境变量控制日志等级：LOG_LEVEL=debug|info|warn|error
 * - 敏感信息自动脱敏
 *
 * 使用方式：
 * ```typescript
 * import { createLogger } from '@/lib/api-station/logger';
 *
 * const logger = createLogger('MyModule');
 * logger.info('操作成功', { userId: '123' });
 * logger.error('操作失败', err, { requestId: 'abc' });
 * ```
 */

// ============================================================================
// 类型定义
// ============================================================================

/** 日志级别 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/** 日志上下文 */
export interface LogContext {
  /** 模块名 */
  module?: string;
  /** 浏览器 ID */
  browserId?: string;
  /** 模型 ID */
  modelId?: string;
  /** 请求追踪 ID */
  requestId?: string;
  /** 用户 ID */
  userId?: string;
  /** 其他自定义字段 */
  [key: string]: unknown;
}

/** 子 Logger 接口 */
export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: unknown, context?: LogContext): void;
}

// ============================================================================
// 敏感信息脱敏
// ============================================================================

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
    return sanitizeContext(value as Record<string, unknown>);
  }

  if (typeof value === 'string' && value.length > 160) {
    return `${value.slice(0, 32)}...[TRUNCATED:${value.length}]`;
  }

  return value;
}

function sanitizeContext(context: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => [key, sanitizeValue(key, value)]),
  );
}

// ============================================================================
// 服务端 Logger（Pino）
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pinoLogger: any = null;

async function getPinoLogger() {
  if (pinoLogger) return pinoLogger;
  
  // 动态导入 pino（仅服务端可用）
  const pino = (await import('pino')).default;
  
  const LOG_LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
  const LOG_PRETTY = process.env.LOG_PRETTY === 'true' || process.env.NODE_ENV !== 'production';

  pinoLogger = pino({
    level: LOG_LEVEL,
    transport: LOG_PRETTY
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
            singleLine: false,
          },
        }
      : undefined,
  });

  return pinoLogger;
}

/** 服务端子 Logger */
class ServerLogger implements Logger {
  private module: string;
  private loggerPromise: ReturnType<typeof getPinoLogger>;

  constructor(module: string) {
    this.module = module;
    this.loggerPromise = getPinoLogger();
  }

  debug(message: string, context?: LogContext): void {
    this.loggerPromise.then(logger => {
      logger.debug({ module: this.module, ...context ? sanitizeContext(context) : {} }, message);
    });
  }

  info(message: string, context?: LogContext): void {
    this.loggerPromise.then(logger => {
      logger.info({ module: this.module, ...context ? sanitizeContext(context) : {} }, message);
    });
  }

  warn(message: string, context?: LogContext): void {
    this.loggerPromise.then(logger => {
      logger.warn({ module: this.module, ...context ? sanitizeContext(context) : {} }, message);
    });
  }

  error(message: string, error?: unknown, context?: LogContext): void {
    this.loggerPromise.then(logger => {
      const errorContext: Record<string, unknown> = context ? { ...context } : {};
      if (error instanceof Error) {
        errorContext.error = error.message;
        errorContext.stack = error.stack;
      } else if (error !== undefined) {
        errorContext.error = String(error);
      }
      logger.error({ module: this.module, ...sanitizeContext(errorContext) }, message);
    });
  }
}

// ============================================================================
// 客户端 Logger（Console 封装）
// ============================================================================

const CLIENT_LOG_LEVELS: Record<string, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function getClientLogLevel(): number {
  if (typeof window === 'undefined') return CLIENT_LOG_LEVELS.info;
  const level = (window as unknown as { __LOG_LEVEL__?: string }).__LOG_LEVEL__ || 'info';
  return CLIENT_LOG_LEVELS[level] ?? CLIENT_LOG_LEVELS.info;
}

/** 客户端子 Logger */
class ClientLogger implements Logger {
  private module: string;
  private level: number;

  constructor(module: string) {
    this.module = module;
    this.level = getClientLogLevel();
  }

  private formatContext(context?: LogContext): string {
    if (!context) return '';
    const sanitized = sanitizeContext(context);
    return Object.keys(sanitized).length > 0 ? ` ${JSON.stringify(sanitized)}` : '';
  }

  debug(message: string, context?: LogContext): void {
    if (this.level <= CLIENT_LOG_LEVELS.debug) {
      console.debug(`[\x1b[36m${this.module}\x1b[0m] ${message}${this.formatContext(context)}`);
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.level <= CLIENT_LOG_LEVELS.info) {
      console.info(`[\x1b[32m${this.module}\x1b[0m] ${message}${this.formatContext(context)}`);
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.level <= CLIENT_LOG_LEVELS.warn) {
      console.warn(`[\x1b[33m${this.module}\x1b[0m] ${message}${this.formatContext(context)}`);
    }
  }

  error(message: string, error?: unknown, context?: LogContext): void {
    if (this.level <= CLIENT_LOG_LEVELS.error) {
      const errorContext: Record<string, unknown> = context ? { ...context } : {};
      if (error instanceof Error) {
        errorContext.error = error.message;
      } else if (error !== undefined) {
        errorContext.error = String(error);
      }
      console.error(`[\x1b[31m${this.module}\x1b[0m] ${message}${this.formatContext(errorContext)}`);
    }
  }
}

// ============================================================================
// 导出
// ============================================================================

const isServer = typeof window === 'undefined';

/**
 * 创建子 Logger
 * 
 * 自动根据运行环境选择服务端（Pino）或客户端（Console）实现
 */
export function createLogger(module: string): Logger {
  return isServer ? new ServerLogger(module) : new ClientLogger(module);
}

// 默认导出一个通用 logger
export const logger = createLogger('app');

// ============================================================================
// 兼容接口（旧 API）
// ============================================================================

/** 生成请求 ID */
export function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** 兼容旧 API：信息日志 */
export function logInfo(message: string, context?: LogContext): void {
  logger.info(message, context);
}

/** 兼容旧 API：调试日志 */
export function logDebug(message: string, context?: LogContext): void {
  logger.debug(message, context);
}

/** 兼容旧 API：警告日志 */
export function logWarn(message: string, context?: LogContext): void {
  logger.warn(message, context);
}

/** 兼容旧 API：错误日志 */
export function logError(message: string, error?: unknown, context?: LogContext): void {
  logger.error(message, error, context);
}
