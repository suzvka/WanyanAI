import {
  ConfigValidationResult,
  ModelConfig,
  ModelConfigProvider,
  ModelConfigStore,
  ModelTestResult,
} from '@/types/modelConfig';
import { modelConfigProvider } from './provider';
import { modelConfigStore } from './store';

export class ModelConfigService {
  constructor(
    private readonly store: ModelConfigStore = modelConfigStore,
    private readonly provider: ModelConfigProvider = modelConfigProvider,
  ) {}

  getConfig(): ModelConfig | null {
    return this.store.getConfig();
  }

  saveConfig(config: ModelConfig): void {
    this.store.saveConfig(config);
  }

  clearConfig(): void {
    this.store.clearConfig();
  }

  validateAndFetchModels(baseUrl: string, apiKey: string): Promise<ConfigValidationResult> {
    return this.provider.validateAndFetchModels(baseUrl, apiKey);
  }

  testModelConnection(baseUrl: string, apiKey: string, model: string): Promise<ModelTestResult> {
    return this.provider.testModelConnection(baseUrl, apiKey, model);
  }
}

export const modelConfigService = new ModelConfigService();
