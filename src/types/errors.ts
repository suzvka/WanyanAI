export type AppErrorCode =
  | 'invalid_input'
  | 'config_invalid'
  | 'invalid_control_selection'
  | 'ops_config_stale'
  | 'template_fetch_failed'
  | 'template_response_invalid'
  | 'provider_request_failed'
  | 'provider_response_invalid'
  | 'json_parse_failed'
  | 'json_repair_failed'
  | 'report_schema_invalid'
  | 'network_error'
  | 'unknown_error';

export type AppErrorPayload = {
  code: AppErrorCode;
  message: string;
  retryable?: boolean;
  status?: number;
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly retryable: boolean;
  readonly status?: number;

  constructor(payload: AppErrorPayload) {
    super(payload.message);
    this.name = 'AppError';
    this.code = payload.code;
    this.retryable = payload.retryable ?? false;
    this.status = payload.status;
  }
}

export function createAppError(payload: AppErrorPayload): AppError {
  return new AppError(payload);
}

export function toAppErrorPayload(error: unknown, fallback: AppErrorPayload): AppErrorPayload {
  if (error instanceof AppError) {
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      status: error.status,
    };
  }

  if (error instanceof Error && error.message.trim()) {
    return {
      ...fallback,
      message: error.message,
    };
  }

  return fallback;
}
