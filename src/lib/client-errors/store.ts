import type { ClientErrorRecord } from './types';

const MAX_CLIENT_ERRORS = 50;
export const DEFAULT_NOTIFICATION_DEDUPE_WINDOW_MS = 8000;

const records: ClientErrorRecord[] = [];
const notifiedAt = new Map<string, number>();

export function storeClientError(
  record: ClientErrorRecord,
  dedupeWindowMs: number = DEFAULT_NOTIFICATION_DEDUPE_WINDOW_MS,
): {
  record: ClientErrorRecord;
  shouldNotify: boolean;
  isDuplicate: boolean;
} {
  const existing = records.find((item) => item.fingerprint === record.fingerprint);
  const nextRecord = existing
    ? {
        ...existing,
        ...record,
        count: existing.count + 1,
        detail: record.detail ?? existing.detail,
        stack: record.stack ?? existing.stack,
        metadata: record.metadata ?? existing.metadata,
      }
    : record;

  const nextRecords = [nextRecord, ...records.filter((item) => item.fingerprint !== record.fingerprint)].slice(0, MAX_CLIENT_ERRORS);
  records.splice(0, records.length, ...nextRecords);

  const lastNotifiedAt = notifiedAt.get(record.fingerprint) ?? 0;
  const shouldNotify = record.notify && record.time - lastNotifiedAt >= dedupeWindowMs;

  if (shouldNotify) {
    notifiedAt.set(record.fingerprint, record.time);
  }

  return {
    record: nextRecord,
    shouldNotify,
    isDuplicate: Boolean(existing),
  };
}

export function listClientErrors(): ClientErrorRecord[] {
  return [...records];
}

export function clearClientErrors(): void {
  records.splice(0, records.length);
  notifiedAt.clear();
}
