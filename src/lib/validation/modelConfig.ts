import { z } from 'zod';
import { ApiConfigDraft, ApiConfigRecord, ApiConfigStoreState, ModelConfig } from '@/types/modelConfig';

export const modelConnectionSchema = z.object({
  baseUrl: z
    .string()
    .trim()
    .min(1, '请输入Base URL')
    .url('请输入有效的Base URL'),
  apiKey: z.string().trim().min(1, '请输入API Key'),
});

export const apiConfigDraftSchema = modelConnectionSchema.extend({
  name: z.string().trim().min(1, '请输入配置名称'),
});

export const modelConfigExecutionSchema = modelConnectionSchema.extend({
  selectedModel: z.string().trim().min(1, '请选择或输入模型'),
});

const modelInfoSchema = z.object({
  id: z.string().trim().min(1, '模型 ID 不能为空'),
  name: z.string().trim().min(1, '模型名称不能为空'),
  description: z.string().optional(),
});

export const apiConfigRecordSchema = apiConfigDraftSchema.extend({
  id: z.string().trim().min(1, '配置 ID 不能为空'),
  selectedModel: z.string().optional().default(''),
  modelsCache: z.array(modelInfoSchema).default([]),
  lastValidationStatus: z.enum(['unknown', 'validating', 'valid', 'invalid']).default('unknown'),
  lastValidationMessage: z.string().optional(),
  validatedAt: z.string().optional(),
});

export const apiConfigStoreStateSchema = z.object({
  configs: z.array(apiConfigRecordSchema).default([]),
  selectedConfigId: z.string().nullable().default(null),
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

export function validateApiConfigDraft(input: ApiConfigDraft):
  | { success: true; data: ApiConfigDraft }
  | { success: false; error: string } {
  const result = apiConfigDraftSchema.safeParse(input);

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
  const result = modelConfigExecutionSchema.safeParse(input);

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

export function validateApiConfigRecord(input: ApiConfigRecord):
  | { success: true; data: ApiConfigRecord }
  | { success: false; error: string } {
  const result = apiConfigRecordSchema.safeParse(input);

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

export function validateApiConfigStoreState(input: ApiConfigStoreState):
  | { success: true; data: ApiConfigStoreState }
  | { success: false; error: string } {
  const result = apiConfigStoreStateSchema.safeParse(input);

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
