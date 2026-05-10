import { createAppError, type AppErrorCode, type AppErrorPayload } from '@/types/errors';
import { reportClientError } from '@/lib/client-errors/report';

type ErrorResponseShape = {
  error?: Partial<AppErrorPayload> & { message?: string };
  message?: string;
};

type ClientRequestOptions = RequestInit & {
  errorCode?: AppErrorCode;
  errorMessage: string;
  networkErrorMessage?: string;
  reportMessage?: string;
  mapErrorMessage?: (message: string) => string;
  abortErrorPayload?: AppErrorPayload;
};

type ReportedError = Error & {
  __clientErrorReported?: boolean;
};

function markReported<T extends Error>(error: T): T {
  (error as ReportedError).__clientErrorReported = true;
  return error;
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

function tryParseJson<T>(text: string): T | null {
  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function readErrorResponse(response: Response): Promise<ErrorResponseShape | null> {
  const text = await safeReadText(response);
  return tryParseJson<ErrorResponseShape>(text);
}

function buildHttpError(response: Response, data: ErrorResponseShape | null, options: ClientRequestOptions) {
  const payload = data?.error;
  const message = payload?.message ?? data?.message ?? options.errorMessage;

  return createAppError({
    code: payload?.code ?? options.errorCode ?? 'network_error',
    message: options.mapErrorMessage ? options.mapErrorMessage(message) : message,
    status: payload?.status ?? response.status,
    retryable: payload?.retryable ?? response.status >= 500,
  });
}

function reportApiError(error: Error, options: ClientRequestOptions, extra?: Record<string, unknown>) {
  reportClientError({
    source: 'api',
    error,
    message: options.reportMessage ?? error.message,
    metadata: extra,
  });
}

export async function requestResponse(input: string, options: ClientRequestOptions): Promise<Response> {
  try {
    const response = await fetch(input, options);

    if (!response.ok) {
      const errorData = await readErrorResponse(response);
      const appError = markReported(buildHttpError(response, errorData, options));
      reportApiError(appError, options, {
        url: input,
        method: options.method ?? 'GET',
        status: response.status,
      });
      throw appError;
    }

    return response;
  } catch (error) {
    if (error instanceof Error && (error as ReportedError).__clientErrorReported) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError' && options.abortErrorPayload) {
      const abortError = markReported(createAppError(options.abortErrorPayload));
      reportApiError(abortError, options, {
        url: input,
        method: options.method ?? 'GET',
        aborted: true,
      });
      throw abortError;
    }

    const appError = markReported(createAppError({
      code: 'network_error',
      message: options.networkErrorMessage ?? options.errorMessage,
      retryable: true,
    }));

    reportApiError(appError, options, {
      url: input,
      method: options.method ?? 'GET',
      originalMessage: error instanceof Error ? error.message : undefined,
    });

    throw appError;
  }
}

export async function requestJson<T>(input: string, options: ClientRequestOptions): Promise<T> {
  const response = await requestResponse(input, options);
  const text = await safeReadText(response);
  const data = tryParseJson<T>(text);

  if (data == null) {
    const appError = markReported(createAppError({
      code: options.errorCode ?? 'unknown_error',
      message: options.errorMessage,
      status: response.status,
      retryable: false,
    }));

    reportApiError(appError, options, {
      url: input,
      method: options.method ?? 'GET',
      status: response.status,
      parse: 'json',
    });

    throw appError;
  }

  return data;
}
