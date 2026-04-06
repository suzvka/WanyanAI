import { showAlert } from '@/lib/alert';
import type { ClientErrorRecord } from './types';

function shouldShowDebugDescription(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

function buildDescription(record: ClientErrorRecord): string | undefined {
  if (!shouldShowDebugDescription()) {
    return undefined;
  }

  const parts = [`来源：${record.source}`];

  if (record.detail && record.detail !== record.message) {
    parts.push(record.detail);
  }

  if (record.count > 1) {
    parts.push(`重复 ${record.count} 次`);
  }

  return parts.join(' · ');
}

export function notifyClientError(record: ClientErrorRecord): void {
  showAlert(record.message, {
    type: record.level === 'warning' ? 'warning' : 'error',
    duration: record.level === 'warning' ? 4000 : 6000,
    id: record.fingerprint,
    description: buildDescription(record),
  });
}
