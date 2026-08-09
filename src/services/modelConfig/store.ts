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

// store 变更事件名（供 subscribe 订阅）
const STORE_UPDATED_EVENT = 'model-config-updated';

// 内存状态缓存：getState 返回稳定引用（供 useSyncExternalStore 订阅使用），
// persistState 写入后同步更新缓存，保证与 localStorage 内容一致
let stateCache: ApiConfigStoreState | null = null;

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
  stateCache = state;

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(STORE_UPDATED_EVENT));
  }
}

export const modelConfigStore: ModelConfigStore = {
  getState(): ApiConfigStoreState {
    if (typeof window === 'undefined') {
      return emptyStoreState;
    }

    if (stateCache) {
      return stateCache;
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = validateApiConfigStoreState(JSON.parse(stored) as ApiConfigStoreState);
        if (parsed.success) {
          stateCache = parsed.data;
          return stateCache;
        }

        localStorage.removeItem(STORAGE_KEY);
        stateCache = emptyStoreState;
        return stateCache;
      }

      const legacyStored = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!legacyStored) {
        stateCache = emptyStoreState;
        return stateCache;
      }

      const migratedState = createMigratedState(legacyStored);
      localStorage.removeItem(LEGACY_STORAGE_KEY);

      if (!migratedState) {
        stateCache = emptyStoreState;
        return stateCache;
      }

      persistState(migratedState);
      return migratedState;
    } catch {
      stateCache = emptyStoreState;
      return stateCache;
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

  subscribe(listener: () => void): () => void {
    if (typeof window === 'undefined') {
      return () => undefined;
    }

    window.addEventListener(STORE_UPDATED_EVENT, listener);
    return () => window.removeEventListener(STORE_UPDATED_EVENT, listener);
  },
};
