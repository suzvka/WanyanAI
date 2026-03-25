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
}

export interface ModelConfigProvider {
  validateAndFetchModels(baseUrl: string, apiKey: string): Promise<ConfigValidationResult>;
}

export interface ModelListResponse {
  data?: Array<{
    id: string;
    description?: string;
  }>;
}

export const STORAGE_KEY = 'ai-text-diagnosis-model-config-store';
export const LEGACY_STORAGE_KEY = 'ai-text-diagnosis-model-config';
