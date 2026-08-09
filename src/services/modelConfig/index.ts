import {
  ApiConfigDraft,
  ApiConfigRecord,
  ApiConfigStoreState,
  ConfigValidationResult,
  ModelConfig,
  ModelConfigProvider,
  ModelConfigStore,
} from '@/types/modelConfig';
import { validateApiConfigDraft } from '@/lib/validation/modelConfig';
import { modelConfigProvider } from './provider';
import { modelConfigStore } from './store';

type RefreshModelsResult = {
  config: ApiConfigRecord | null;
  validation: ConfigValidationResult;
};

function cloneState(state: ApiConfigStoreState): ApiConfigStoreState {
  return {
    selectedConfigId: state.selectedConfigId,
    configs: state.configs.map((config) => ({
      ...config,
      modelsCache: config.modelsCache.map((model) => ({ ...model })),
    })),
  };
}

function buildValidationTimestamp() {
  return new Date().toISOString();
}

export class ModelConfigService {
  constructor(
    private readonly store: ModelConfigStore = modelConfigStore,
    private readonly provider: ModelConfigProvider = modelConfigProvider,
  ) {}

  // service 层状态缓存：clone 后缓存稳定引用（供 useSyncExternalStore 订阅使用），
  // saveState 写入后失效，下次读取时重新 clone
  private stateCache: ApiConfigStoreState | null = null;

  private getState(): ApiConfigStoreState {
    if (this.stateCache) {
      return this.stateCache;
    }

    this.stateCache = cloneState(this.store.getState());
    return this.stateCache;
  }

  private saveState(state: ApiConfigStoreState): ApiConfigStoreState {
    this.store.saveState(state);
    this.stateCache = null;
    return state;
  }

  private updateConfigInState(
    state: ApiConfigStoreState,
    configId: string,
    updater: (config: ApiConfigRecord) => ApiConfigRecord,
  ): ApiConfigStoreState {
    return {
      ...state,
      configs: state.configs.map((config) => (config.id === configId ? updater(config) : config)),
    };
  }

  listConfigs(): ApiConfigRecord[] {
    return this.getState().configs;
  }

  getSelectedConfig(): ApiConfigRecord | null {
    const state = this.getState();
    return state.configs.find((config) => config.id === state.selectedConfigId) || null;
  }

  getConfig(): ModelConfig | null {
    const selectedConfig = this.getSelectedConfig();

    if (!selectedConfig || !selectedConfig.selectedModel.trim()) {
      return null;
    }

    return {
      baseUrl: selectedConfig.baseUrl,
      apiKey: selectedConfig.apiKey,
      selectedModel: selectedConfig.selectedModel,
    };
  }

  createConfig(input: ApiConfigDraft): ApiConfigRecord {
    const parsed = validateApiConfigDraft(input);
    if (!parsed.success) {
      throw new Error(parsed.error);
    }

    const state = this.getState();
    const config: ApiConfigRecord = {
      id: crypto.randomUUID(),
      name: parsed.data.name,
      baseUrl: parsed.data.baseUrl,
      apiKey: parsed.data.apiKey,
      selectedModel: '',
      modelsCache: [],
      lastValidationStatus: 'unknown',
    };

    this.saveState({
      configs: [...state.configs, config],
      selectedConfigId: config.id,
    });

    return config;
  }

  updateConfig(configId: string, input: ApiConfigDraft): ApiConfigRecord {
    const parsed = validateApiConfigDraft(input);
    if (!parsed.success) {
      throw new Error(parsed.error);
    }

    const state = this.getState();
    const currentConfig = state.configs.find((config) => config.id === configId);
    if (!currentConfig) {
      throw new Error('未找到待更新的配置');
    }

    const nextConfig: ApiConfigRecord = {
      ...currentConfig,
      name: parsed.data.name,
      baseUrl: parsed.data.baseUrl,
      apiKey: parsed.data.apiKey,
      modelsCache: [],
      selectedModel: '',
      lastValidationStatus: 'unknown',
      lastValidationMessage: undefined,
      validatedAt: undefined,
    };

    this.saveState(this.updateConfigInState(state, configId, () => nextConfig));
    return nextConfig;
  }

  removeConfig(configId: string): ApiConfigStoreState {
    const state = this.getState();
    const configs = state.configs.filter((config) => config.id !== configId);
    const selectedConfigId =
      state.selectedConfigId === configId ? (configs[0]?.id ?? null) : state.selectedConfigId;

    return this.saveState({
      configs,
      selectedConfigId,
    });
  }

  selectConfig(configId: string): ApiConfigRecord | null {
    const state = this.getState();
    const config = state.configs.find((item) => item.id === configId) || null;

    if (!config) {
      return null;
    }

    this.saveState({
      ...state,
      selectedConfigId: configId,
    });

    return config;
  }

  saveSelectedModel(configId: string, selectedModel: string): ApiConfigRecord | null {
    const state = this.getState();
    const targetConfig = state.configs.find((config) => config.id === configId) || null;

    if (!targetConfig) {
      return null;
    }

    const nextConfig = {
      ...targetConfig,
      selectedModel,
    };

    this.saveState(this.updateConfigInState(state, configId, () => nextConfig));
    return nextConfig;
  }

  markConfigValidating(configId: string): ApiConfigRecord | null {
    const state = this.getState();
    const targetConfig = state.configs.find((config) => config.id === configId) || null;

    if (!targetConfig) {
      return null;
    }

    const nextConfig: ApiConfigRecord = {
      ...targetConfig,
      lastValidationStatus: 'validating',
      lastValidationMessage: '正在验证并刷新模型列表…',
    };

    this.saveState(this.updateConfigInState(state, configId, () => nextConfig));
    return nextConfig;
  }

  async refreshModels(configId: string): Promise<RefreshModelsResult> {
    const currentConfig = this.markConfigValidating(configId);
    if (!currentConfig) {
      return {
        config: null,
        validation: {
          success: false,
          error: {
            code: 'config_invalid',
            message: '未找到待验证的配置',
          },
        },
      };
    }

    const validation = await this.provider.validateAndFetchModels(currentConfig.baseUrl, currentConfig.apiKey);
    const currentState = this.getState();
    const latestConfig = currentState.configs.find((config) => config.id === configId) || null;

    if (!latestConfig) {
      return {
        config: null,
        validation,
      };
    }

    const timestamp = buildValidationTimestamp();
    const nextConfig: ApiConfigRecord = validation.success
      ? {
          ...latestConfig,
          modelsCache: validation.models || [],
          selectedModel:
            latestConfig.selectedModel && (validation.models || []).some((model) => model.id === latestConfig.selectedModel)
              ? latestConfig.selectedModel
              : '',
          lastValidationStatus: 'valid',
          lastValidationMessage: 'API 配置可用，模型列表已更新。',
          validatedAt: timestamp,
        }
      : {
          ...latestConfig,
          modelsCache: [],
          selectedModel: '',
          lastValidationStatus: 'invalid',
          lastValidationMessage: validation.error?.message || 'API 配置校验失败。',
          validatedAt: timestamp,
        };

    this.saveState(this.updateConfigInState(currentState, configId, () => nextConfig));

    return {
      config: nextConfig,
      validation,
    };
  }

  validateAndFetchModels(baseUrl: string, apiKey: string): Promise<ConfigValidationResult> {
    return this.provider.validateAndFetchModels(baseUrl, apiKey);
  }
}

export const modelConfigService = new ModelConfigService();
