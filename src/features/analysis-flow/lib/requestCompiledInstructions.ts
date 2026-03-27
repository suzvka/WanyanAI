import { createAppError } from '@/types/errors';
import { readCompileInstructionsResponse } from './readCompileInstructionsResponse';

type RequestCompiledInstructionsPayload = {
  controlSelections: Record<string, string>;
  configVersion: string;
};

export async function requestCompiledInstructions(payload: RequestCompiledInstructionsPayload) {
  let response: Response;

  try {
    response = await fetch('/api/instructions/compile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch {
    throw createAppError({
      code: 'network_error',
      message: '动态指令请求失败，请检查网络连接后重试。',
      retryable: true,
    });
  }

  const data = await readCompileInstructionsResponse(response);

  if (!response.ok) {
    throw createAppError(
      data && 'error' in data
        ? data.error
        : {
            code: 'unknown_error',
            message: '动态指令请求失败。',
            status: response.status,
            retryable: response.status >= 500,
          },
    );
  }

  if (!data || !('instructionText' in data)) {
    throw createAppError({
      code: 'unknown_error',
      message: '动态指令响应格式异常。',
    });
  }

  return data;
}
