export interface ModelConfig {
  baseUrl: string;
  apiKey: string;
  selectedModel: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
}

export interface ConfigValidationResult {
  success: boolean;
  error?: string;
  models?: ModelInfo[];
}

export interface ModelTestResult {
  success: boolean;
  error?: string;
  response?: unknown;
}

export interface ModelConfigStore {
  getConfig(): ModelConfig | null;
  saveConfig(config: ModelConfig): void;
  clearConfig(): void;
}

export interface ModelConfigProvider {
  validateAndFetchModels(baseUrl: string, apiKey: string): Promise<ConfigValidationResult>;
  testModelConnection(baseUrl: string, apiKey: string, model: string): Promise<ModelTestResult>;
}

export interface ModelListResponse {
  data?: Array<{
    id: string;
    description?: string;
  }>;
}

export const STORAGE_KEY = 'ai-text-diagnosis-model-config';
