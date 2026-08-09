import { AppErrorPayload } from '@/types/errors';

export interface ModelConfig {
  baseUrl: string;
  apiKey: string;
  selectedModel: string;
}

export type ApiConfigValidationStatus = 'unknown' | 'validating' | 'valid' | 'invalid';

export interface ApiConfigRecord extends ModelConfig {
  id: string;
  name: string;
  modelsCache: ModelInfo[];
  lastValidationStatus: ApiConfigValidationStatus;
  lastValidationMessage?: string;
  validatedAt?: string;
}

export interface ApiConfigDraft {
  name: string;
  baseUrl: string;
  apiKey: string;
}

export interface ApiConfigStoreState {
  configs: ApiConfigRecord[];
  selectedConfigId: string | null;
}

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
}

export interface ConfigValidationResult {
  success: boolean;
  error?: AppErrorPayload;
  models?: ModelInfo[];
}

export interface ModelConfigStore {
  getState(): ApiConfigStoreState;
  saveState(state: ApiConfigStoreState): void;
  /** 订阅 store 变更（写入后同步通知，返回取消订阅函数） */
  subscribe(listener: () => void): () => void;
}

// Chat Completions 请求体（OpenAI 格式）
export interface ChatCompletionsRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  stream?: boolean;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  [key: string]: unknown;
}

// Chat Completions 结果
export interface ChatCompletionsResult {
  success: boolean;
  error?: AppErrorPayload;
  response?: Response;
}

export interface ModelConfigProvider {
  validateAndFetchModels(baseUrl: string, apiKey: string): Promise<ConfigValidationResult>;
  chatCompletions(baseUrl: string, apiKey: string, body: ChatCompletionsRequest): Promise<ChatCompletionsResult>;
}

export interface ModelListResponse {
  data?: Array<{
    id: string;
    name?: string;
    description?: string;
  }>;
}

export const STORAGE_KEY = 'ai-text-diagnosis-model-config-store';
export const LEGACY_STORAGE_KEY = 'ai-text-diagnosis-model-config';
