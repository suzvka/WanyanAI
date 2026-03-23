import { z } from 'zod';
import { ModelConfig } from '@/types/modelConfig';

export const modelConnectionSchema = z.object({
  baseUrl: z
    .string()
    .trim()
    .min(1, '请输入Base URL')
    .url('请输入有效的Base URL'),
  apiKey: z.string().trim().min(1, '请输入API Key'),
});

export const modelConfigSchema = modelConnectionSchema.extend({
  selectedModel: z.string().trim().min(1, '请选择或输入模型'),
});

export function validateModelConnectionInput(baseUrl: string, apiKey: string):
  | { success: true; data: z.infer<typeof modelConnectionSchema> }
  | { success: false; error: string } {
  const result = modelConnectionSchema.safeParse({ baseUrl, apiKey });

  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }

  return {
    success: false,
    error: result.error.issues[0]?.message || '模型配置校验失败',
  };
}

export function validateModelConfig(input: ModelConfig):
  | { success: true; data: ModelConfig }
  | { success: false; error: string } {
  const result = modelConfigSchema.safeParse(input);

  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }

  return {
    success: false,
    error: result.error.issues[0]?.message || '模型配置校验失败',
  };
}
