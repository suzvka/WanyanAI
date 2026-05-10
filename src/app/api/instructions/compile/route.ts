import { NextResponse } from 'next/server';
import { validateInstructionCompileRequest } from '@/lib/validation/instructionCompileRequest';
import { compileDynamicInstructions } from '@/server/instructions/compile';
import { toAppErrorPayload } from '@/types/errors';
import type { CompileInstructionsErrorResponse, CompileInstructionsSuccessResponse } from '@/types/instructions';

export async function POST(request: Request) {
  try {
    const parsed = validateInstructionCompileRequest(await request.json());

    if (!parsed.success) {
      const response: CompileInstructionsErrorResponse = {
        error: {
          code: 'invalid_input',
          message: parsed.error.issues[0]?.message || '动态指令编译输入不合法',
          status: 400,
        },
      };

      return NextResponse.json(response, { status: 400 });
    }

    const compiled = await compileDynamicInstructions(parsed.data);
    const response: CompileInstructionsSuccessResponse = compiled;

    return NextResponse.json(response);
  } catch (error) {
    const payload = toAppErrorPayload(error, {
      code: 'unknown_error',
      message: '动态指令编译失败',
      status: 500,
      retryable: true,
    });
    const response: CompileInstructionsErrorResponse = {
      error: payload,
    };

    return NextResponse.json(response, { status: payload.status ?? 500 });
  }
}
