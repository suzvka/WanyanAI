import type {
  CompileInstructionsErrorResponse,
  CompileInstructionsSuccessResponse,
} from '@/types/instructions';

export async function readCompileInstructionsResponse(
  response: Response,
): Promise<CompileInstructionsSuccessResponse | CompileInstructionsErrorResponse | null> {
  const text = await response.text();

  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text) as CompileInstructionsSuccessResponse | CompileInstructionsErrorResponse;
  } catch {
    return null;
  }
}
