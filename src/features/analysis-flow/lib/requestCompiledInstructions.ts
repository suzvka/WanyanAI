import { compileDynamicInstructions } from '@/server/instructions/compile';
import { createAppError } from '@/types/errors';
import type {
  CompileInstructionsErrorResponse,
  CompileInstructionsSuccessResponse,
} from '@/types/instructions';

type RequestCompiledInstructionsPayload = {
  controlSelections: Record<string, string>;
  configVersion: string;
};

/**
 * 请求编译动态指令
 * 
 * 在服务端直接调用 compileDynamicInstructions，避免 HTTP 请求
 */
export async function requestCompiledInstructions(payload: RequestCompiledInstructionsPayload) {
  try {
    const compiled = await compileDynamicInstructions(payload);
    return compiled as CompileInstructionsSuccessResponse;
  } catch (error) {
    throw createAppError({
      code: 'unknown_error',
      message: error instanceof Error ? error.message : '动态指令编译失败',
    });
  }
}
