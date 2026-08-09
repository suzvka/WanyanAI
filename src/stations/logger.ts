/**
 * 中转站模块日志抽象
 *
 * 自包含的最小日志接口，使中转站模块不依赖项目内部的日志设施。
 * Logger 接口签名与项目 api-station/logger 的 Logger 结构保持一致，
 * 宿主环境可将自己的 logger（如 pino）直接注入。
 *
 * 使用方式：
 * ```typescript
 * import { createLogger, type Logger } from './logger';
 *
 * const logger = createLogger('MyStation');
 * logger.info('操作成功', { requestId });
 * ```
 */

/** 日志上下文 */
export interface LogContext {
  [key: string]: unknown;
}

/** 子 Logger 接口 */
export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: unknown, context?: LogContext): void;
}

/** 基于 console 的默认实现（带模块名前缀） */
class ConsoleLogger implements Logger {
  private module: string;

  constructor(module: string) {
    this.module = module;
  }

  debug(message: string, context?: LogContext): void {
    console.debug(`[${this.module}] ${message}`, context ? context : '');
  }

  info(message: string, context?: LogContext): void {
    console.info(`[${this.module}] ${message}`, context ? context : '');
  }

  warn(message: string, context?: LogContext): void {
    console.warn(`[${this.module}] ${message}`, context ? context : '');
  }

  error(message: string, error?: unknown, context?: LogContext): void {
    if (error !== undefined) {
      console.error(`[${this.module}] ${message}`, error, context ? context : '');
    } else {
      console.error(`[${this.module}] ${message}`, context ? context : '');
    }
  }
}

/**
 * 创建子 Logger
 *
 * 默认基于 console 输出；宿主环境可在初始化时注入自定义 logger。
 */
export function createLogger(module: string): Logger {
  return new ConsoleLogger(module);
}
