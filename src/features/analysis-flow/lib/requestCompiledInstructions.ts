import { requestJson } from '@/lib/client-request';
import { createAppError } from '@/types/errors';
import type {
  CompileInstructionsErrorResponse,
  CompileInstructionsSuccessResponse,
} from '@/types/instructions';

type RequestCompiledInstructionsPayload = {
  controlSelections: Record<string, string>;
  configVersion: string;
};

export async function requestCompiledInstructions(payload: RequestCompiledInstructionsPayload) {
  const data = await requestJson<CompileInstructionsSuccessResponse | CompileInstructionsErrorResponse>('/api/instructions/compile', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    errorMessage: '动态指令请求失败。',
    networkErrorMessage: '动态指令请求失败，请检查网络连接后重试。',
  });

  if (!data || !('instructionText' in data)) {
    throw createAppError({
      code: 'unknown_error',
      message: '动态指令响应格式异常。',
    });
  }

  return data;
}
