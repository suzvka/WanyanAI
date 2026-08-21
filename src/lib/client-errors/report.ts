import { normalizeClientError } from './normalize';
import { notifyClientError } from './notify';
import { storeClientError } from './store';
import type { ClientErrorLevel, ClientErrorRecord, ClientErrorReportInput, ClientErrorSource } from './types';

const IGNORED_CONSOLE_PREFIXES = [
  '[GlobalErrorHandler]',
  '[GlobalErrorBoundary]',
  '[ReportErrorBoundary]',
];

type ReportedError = Error & {
  __clientErrorReported?: boolean;
};

function stringifyConsoleArg(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof Error) {
    return value.stack || value.message;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function joinConsoleArgs(args: unknown[]): { message: string; detail?: string } {
  const parts = args.map((arg) => stringifyConsoleArg(arg)).filter(Boolean);
  const [message = '控制台输出了错误日志', ...rest] = parts;

  return {
    message: message.slice(0, 160),
    detail: rest.length > 0 ? rest.join(' ').slice(0, 240) : undefined,
  };
}

function hasIgnoredConsolePrefix(args: unknown[]): boolean {
  const firstArg = args[0];
  return typeof firstArg === 'string' && IGNORED_CONSOLE_PREFIXES.some((prefix) => firstArg.startsWith(prefix));
}

export function reportClientError(input: ClientErrorReportInput): ClientErrorRecord {
  const normalized = normalizeClientError(input);
  const result = storeClientError(normalized, input.dedupeWindowMs);

  if (result.shouldNotify) {
    notifyClientError(result.record);
  }

  return result.record;
}

export function reportConsoleMessage(level: ClientErrorLevel, args: unknown[]): ClientErrorRecord | null {
  if (args.length === 0 || hasIgnoredConsolePrefix(args)) {
    return null;
  }

  const { message, detail } = joinConsoleArgs(args);

  return reportClientError({
    source: 'console',
    level,
    message,
    detail,
    notify: level === 'error',
    metadata: { argsCount: args.length },
  });
}

export function reportWindowError(error: unknown, message?: string): ClientErrorRecord {
  return reportClientError({
    source: 'runtime',
    error,
    message,
  });
}

export function reportUnhandledRejection(reason: unknown): ClientErrorRecord {
  return reportClientError({
    source: 'promise',
    error: reason,
    message: reason instanceof Error ? reason.message : '发生未处理的异步错误，请稍后重试。',
  });
}

export function reportReactError(
  error: unknown,
  options?: {
    source?: Extract<ClientErrorSource, 'react' | 'react-report'>;
    detail?: string;
  },
): ClientErrorRecord {
  return reportClientError({
    source: options?.source ?? 'react',
    error,
    detail: options?.detail,
  });
}

export function reportBusinessError(error: unknown, message?: string): ClientErrorRecord {
  const notify = !(error instanceof Error && (error as ReportedError).__clientErrorReported);

  return reportClientError({
    source: 'business',
    error,
    message,
    notify,
  });
}

export type { ClientErrorLevel, ClientErrorRecord, ClientErrorReportInput, ClientErrorSource } from './types';
