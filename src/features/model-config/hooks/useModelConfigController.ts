'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import { showError, showSuccess } from '@/lib/alert';
import { modelConfigService } from '@/services/modelConfig';
import { toAppErrorPayload } from '@/types/errors';
import type { ApiConfigDraft, ApiConfigRecord, ModelConfig } from '@/types/modelConfig';
import { modelConfigStore } from '@/services/modelConfig/store';

type UseModelConfigControllerOptions = {
  onConfigInteraction?: () => void;
};

type RefreshModelsResult = Awaited<ReturnType<typeof modelConfigService.refreshModels>>;

// 服务端快照必须返回稳定引用：每次调用返回新数组会导致 hydration 无限循环
const EMPTY_API_CONFIGS: ApiConfigRecord[] = [];
const getServerApiConfigs = () => EMPTY_API_CONFIGS;
const getServerSelectedConfigId = () => null;

export function useModelConfigController({ onConfigInteraction }: UseModelConfigControllerOptions = {}) {
  // 订阅 modelConfigStore：store 写入（含其他模块）后自动同步，无需手动 setState
  const apiConfigs = useSyncExternalStore(
    modelConfigStore.subscribe,
    () => modelConfigService.listConfigs(),
    getServerApiConfigs,
  );
  const selectedConfigId = useSyncExternalStore(
    modelConfigStore.subscribe,
    () => modelConfigService.getSelectedConfig()?.id ?? null,
    getServerSelectedConfigId,
  );
  const [isConfigMutating, setIsConfigMutating] = useState(false);
  const [isModelRefreshing, setIsModelRefreshing] = useState(false);

  const selectedConfig = useMemo(
    () => apiConfigs.find((config: ApiConfigRecord) => config.id === selectedConfigId) || null,
    [apiConfigs, selectedConfigId],
  );

  const currentModelConfig = useMemo<ModelConfig | null>(
    () =>
      selectedConfig?.selectedModel
        ? {
            baseUrl: selectedConfig.baseUrl,
            apiKey: selectedConfig.apiKey,
            selectedModel: selectedConfig.selectedModel,
          }
        : null,
    [selectedConfig],
  );

  const refreshModels = async (configId: string, showToast = true): Promise<RefreshModelsResult> => {
    setIsModelRefreshing(true);

    try {
      const refreshTask = modelConfigService.refreshModels(configId);

      const result = await refreshTask;

      if (showToast) {
        if (result.validation.success) {
          showSuccess(result.config?.lastValidationMessage || 'API 配置校验成功。');
        } else {
          showError(result.validation.error?.message || 'API 配置校验失败。');
        }
      }

      return result;
    } catch (error) {
      const payload = toAppErrorPayload(error, {
        code: 'unknown_error',
        message: '模型列表刷新失败，请稍后重试。',
      });

      if (showToast) {
        showError(payload.message);
      }

      return {
        config: null,
        validation: {
          success: false,
          error: payload,
        },
      };
    } finally {
      setIsModelRefreshing(false);
    }
  };

  const createConfig = async (value: ApiConfigDraft) => {
    setIsConfigMutating(true);

    try {
      const createdConfig = modelConfigService.createConfig(value);
      onConfigInteraction?.();
      await refreshModels(createdConfig.id);
    } catch (error) {
      const payload = toAppErrorPayload(error, {
        code: 'config_invalid',
        message: '创建配置失败，请检查输入。',
      });
      showError(payload.message);
    } finally {
      setIsConfigMutating(false);
    }
  };

  const updateConfig = async (configId: string, value: ApiConfigDraft) => {
    setIsConfigMutating(true);

    try {
      modelConfigService.updateConfig(configId, value);
      onConfigInteraction?.();
      await refreshModels(configId);
    } catch (error) {
      const payload = toAppErrorPayload(error, {
        code: 'config_invalid',
        message: '更新配置失败，请检查输入。',
      });
      showError(payload.message);
    } finally {
      setIsConfigMutating(false);
    }
  };

  const deleteConfig = async (configId: string) => {
    setIsConfigMutating(true);

    try {
      modelConfigService.removeConfig(configId);
      showSuccess('API 配置已删除。');
    } catch (error) {
      const payload = toAppErrorPayload(error, {
        code: 'unknown_error',
        message: '删除配置失败，请重试。',
      });
      showError(payload.message);
    } finally {
      setIsConfigMutating(false);
    }
  };

  const selectConfig = async (configId: string) => {
    modelConfigService.selectConfig(configId);
    onConfigInteraction?.();
    await refreshModels(configId);
  };

  const selectModel = (value: string) => {
    if (!selectedConfig) {
      return;
    }

    modelConfigService.saveSelectedModel(selectedConfig.id, value);
    onConfigInteraction?.();
  };

  return {
    apiConfigs,
    selectedConfigId,
    selectedConfig,
    currentModelConfig,
    isConfigMutating,
    isModelRefreshing,
    isConfigBusy: isConfigMutating || isModelRefreshing,
    refreshModels,
    createConfig,
    updateConfig,
    deleteConfig,
    selectConfig,
    selectModel,
  };
}
