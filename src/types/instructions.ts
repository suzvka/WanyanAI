import type { AppErrorPayload } from '@/types/errors';

export type CompileInstructionsRequest = {
  controlSelections: Record<string, string>;
  configVersion: string;
};

export type CompileInstructionsSuccessResponse = {
  instructionText: string;
  resolvedSelections: Record<string, string>;
  configVersion: string;
};

export type CompileInstructionsErrorResponse = {
  error: AppErrorPayload;
};
