export type ClientErrorSource =
  | 'runtime'
  | 'promise'
  | 'react'
  | 'react-report'
  | 'console'
  | 'api'
  | 'business';

export type ClientErrorLevel = 'error' | 'warning';

export type ClientErrorRecord = {
  id: string;
  time: number;
  source: ClientErrorSource;
  level: ClientErrorLevel;
  message: string;
  detail?: string;
  stack?: string;
  fingerprint: string;
  notify: boolean;
  count: number;
  metadata?: Record<string, unknown>;
};

export type ClientErrorReportInput = {
  source: ClientErrorSource;
  level?: ClientErrorLevel;
  error?: unknown;
  message?: string;
  detail?: string;
  stack?: string;
  notify?: boolean;
  fingerprint?: string;
  dedupeWindowMs?: number;
  metadata?: Record<string, unknown>;
};
