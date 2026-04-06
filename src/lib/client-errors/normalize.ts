import { AppError } from '@/types/errors';
import type { ClientErrorRecord, ClientErrorReportInput } from './types';

function safeStringify(value: unknown): string | undefined {
  if (value == null) {
    return undefined;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function truncate(value: string | undefined, maxLength = 240): string | undefined {
  if (!value) {
    return value;
  }

  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
}

function getMessage(error: unknown): string | undefined {
  if (error instanceof AppError) {
    return error.message;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return undefined;
}

function getStack(error: unknown): string | undefined {
  if (error instanceof Error && error.stack?.trim()) {
    return error.stack;
  }

  return undefined;
}

function getDetail(error: unknown): string | undefined {
  if (error instanceof Error) {
    return truncate(error.name === 'Error' ? undefined : error.name, 120);
  }

  if (typeof error === 'string') {
    return undefined;
  }

  return truncate(safeStringify(error), 240);
}

function buildFingerprint(input: {
  source: ClientErrorReportInput['source'];
  level: NonNullable<ClientErrorReportInput['level']>;
  message: string;
  detail?: string;
  stack?: string;
}): string {
  const parts = [
    input.source,
    input.level,
    input.message.trim(),
    input.stack?.split('\n')[0]?.trim() ?? '',
    input.detail?.trim() ?? '',
  ];

  return parts.filter(Boolean).join('::').slice(0, 512);
}

export function normalizeClientError(input: ClientErrorReportInput): ClientErrorRecord {
  const level = input.level ?? 'error';
  const message = truncate(input.message?.trim() || getMessage(input.error) || '发生未知错误，请稍后重试。', 160) ?? '发生未知错误，请稍后重试。';
  const detail = truncate(input.detail ?? getDetail(input.error), 240);
  const stack = input.stack ?? getStack(input.error);

  return {
    id: `client-error-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    time: Date.now(),
    source: input.source,
    level,
    message,
    detail,
    stack,
    fingerprint: input.fingerprint ?? buildFingerprint({
      source: input.source,
      level,
      message,
      detail,
      stack,
    }),
    notify: input.notify ?? level === 'error',
    count: 1,
    metadata: input.metadata,
  };
}
