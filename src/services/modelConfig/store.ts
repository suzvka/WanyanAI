import { validateApiConfigStoreState, validateModelConfig } from '@/lib/validation/modelConfig';
import {
  ApiConfigRecord,
  ApiConfigStoreState,
  LEGACY_STORAGE_KEY,
  ModelConfigStore,
  STORAGE_KEY,
} from '@/types/modelConfig';

const emptyStoreState: ApiConfigStoreState = {
  configs: [],
  selectedConfigId: null,
};

function buildMigratedConfigName(baseUrl: string) {
  try {
    const { hostname } = new URL(baseUrl);
    return hostname || '已迁移配置';
  } catch {
    return '已迁移配置';
  }
}

function createMigratedState(rawValue: string): ApiConfigStoreState | null {
  try {
    const parsed = validateModelConfig(JSON.parse(rawValue));
    if (!parsed.success) {
      return null;
    }

    const migratedConfig: ApiConfigRecord = {
      id: crypto.randomUUID(),
      name: buildMigratedConfigName(parsed.data.baseUrl),
      baseUrl: parsed.data.baseUrl,
      apiKey: parsed.data.apiKey,
      selectedModel: parsed.data.selectedModel,
      modelsCache: [],
      lastValidationStatus: 'unknown',
    };

    return {
      configs: [migratedConfig],
      selectedConfigId: migratedConfig.id,
    };
  } catch {
    return null;
  }
}

function persistState(state: ApiConfigStoreState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export const modelConfigStore: ModelConfigStore = {
  getState(): ApiConfigStoreState {
    if (typeof window === 'undefined') {
      return emptyStoreState;
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = validateApiConfigStoreState(JSON.parse(stored) as ApiConfigStoreState);
        if (parsed.success) {
          return parsed.data;
        }

        localStorage.removeItem(STORAGE_KEY);
        return emptyStoreState;
      }

      const legacyStored = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!legacyStored) {
        return emptyStoreState;
      }

      const migratedState = createMigratedState(legacyStored);
      localStorage.removeItem(LEGACY_STORAGE_KEY);

      if (!migratedState) {
        return emptyStoreState;
      }

      persistState(migratedState);
      return migratedState;
    } catch {
      return emptyStoreState;
    }
  },

  saveState(state: ApiConfigStoreState): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const parsed = validateApiConfigStoreState(state);
      if (!parsed.success) {
        throw new Error(parsed.error);
      }

      persistState(parsed.data);
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : '保存配置失败');
    }
  },
};
