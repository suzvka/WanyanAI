import { NextResponse } from 'next/server';

type ValidationIssue = {
  path: string;
  message: string;
};

export function outputModeSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function outputModeError(message: string, status = 500) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export function outputModeValidationError(message: string, status = 400, path = '') {
  return NextResponse.json(
    { success: false, errors: [{ path, message }] satisfies ValidationIssue[] },
    { status },
  );
}

export function getErrorMessage(error: unknown, fallback = 'Unknown error'): string {
  return error instanceof Error ? error.message : fallback;
}
