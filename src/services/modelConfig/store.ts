import { ModelConfig, ModelConfigStore, STORAGE_KEY } from '@/types/modelConfig';
import { validateModelConfig } from '@/lib/validation/modelConfig';

export const modelConfigStore: ModelConfigStore = {
  getConfig(): ModelConfig | null {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return null;
      }

      const parsed = validateModelConfig(JSON.parse(stored) as ModelConfig);
      if (!parsed.success) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }

      return parsed.data;
    } catch (error) {
      console.error('Failed to read config from storage:', error);
      return null;
    }
  },

  saveConfig(config: ModelConfig): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const parsed = validateModelConfig(config);
      if (!parsed.success) {
        throw new Error(parsed.error);
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed.data));
    } catch (error) {
      console.error('Failed to save config to storage:', error);
      throw new Error(error instanceof Error ? error.message : '保存配置失败');
    }
  },

  clearConfig(): void {
    if (typeof window === 'undefined') {
      return;
    }

    localStorage.removeItem(STORAGE_KEY);
  },
};
