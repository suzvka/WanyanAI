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
  response?: any;
}

export const STORAGE_KEY = 'ai-text-diagnosis-model-config';
