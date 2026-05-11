import { z } from 'zod';

export const compileInstructionsRequestSchema = z.object({
  controlSelections: z.record(z.string(), z.string().trim().min(1)).default({}),
  configVersion: z.string().trim().min(1),
});

export function validateInstructionCompileRequest(input: unknown) {
  return compileInstructionsRequestSchema.safeParse(input);
}

export type InstructionCompileRequestValidationResult = ReturnType<typeof validateInstructionCompileRequest>;
