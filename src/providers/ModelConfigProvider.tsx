'use client';

import { createContext, useContext, useState, useMemo, useEffect, ReactNode } from 'react';
import { useModelConfigController } from '@/features/model-config/hooks/useModelConfigController';
import { modelConfigProvider } from '@/services/modelConfig/provider';
import { 
  getBuiltInApiKey, 
  getBuiltInBaseUrl, 
  getBuiltInModelsCache, 
  saveBuiltInModelsCache,
  clearBuiltInModelsCache
} from '@/lib/api-station/builtInConfig';
import type { ApiConfigRecord, ApiConfigValidationStatus, ModelConfig, ModelInfo } from '@/types/modelConfig';

type ModelConfigContextValue = {
  apiConfigs: ApiConfigRecord[];
  selectedConfigId: string | null;
  selectedConfig: ApiConfigRecord | null;
  currentModelConfig: ModelConfig | null;
  isConfigBusy: boolean;
  createConfig: (value: Parameters<ReturnType<typeof useModelConfigController>['createConfig']>[0]) => Promise<void>;
  updateConfig: (configId: string, value: Parameters<ReturnType<typeof useModelConfigController>['updateConfig']>[1]) => Promise<void>;
  deleteConfig: (configId: string) => Promise<void>;
  selectConfig: (configId: string) => Promise<void>;
  selectModel: (value: string) => void;
  isConfigDialogOpen: boolean;
  setIsConfigDialogOpen: (open: boolean) => void;
  // 内置模式
  useBuiltInMode: boolean;
  setUseBuiltInMode: (value: boolean) => void;
  builtInModels: ModelInfo[];
  builtInSelectedModel: string | null;
  builtInValidationStatus: ApiConfigValidationStatus;
  selectBuiltInModel: (modelId: string) => void;
  refreshBuiltInModels: () => Promise<void>;
};

const ModelConfigContext = createContext<ModelConfigContextValue | null>(null);

interface ModelConfigProviderProps {
  children: ReactNode;
}

export function ModelConfigProvider({ children }: ModelConfigProviderProps) {
  const controller = useModelConfigController();
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  
  // 内置模式状态（默认开启）
  const [useBuiltInMode, setUseBuiltInMode] = useState(true);
  
  // 内置模式的模型列表、选择和验证状态（与自定义配置一致）
  // 初始化时先从缓存读取
  const [builtInModels, setBuiltInModels] = useState<ModelInfo[]>(() => {
    const cache = getBuiltInModelsCache();
    return cache?.models || [];
  });
  const [builtInSelectedModel, setBuiltInSelectedModel] = useState<string | null>(() => {
    const cache = getBuiltInModelsCache();
    return cache?.selectedModel || null;
  });
  const [builtInValidationStatus, setBuiltInValidationStatus] = useState<ApiConfigValidationStatus>(() => {
    const cache = getBuiltInModelsCache();
    return cache?.validationStatus || 'unknown';
  });

  // 使用与自定义配置相同的验证逻辑获取内置模型列表
  const refreshBuiltInModels = async () => {
    // 清除旧缓存，确保获取最新数据
    clearBuiltInModelsCache();

    const baseUrl = getBuiltInBaseUrl();
    const apiKey = getBuiltInApiKey();

    if (!baseUrl || !apiKey) {
      setBuiltInValidationStatus('invalid');
      saveBuiltInModelsCache([], 'invalid', null);
      return;
    }

    setBuiltInValidationStatus('validating');

    const result = await modelConfigProvider.validateAndFetchModels(baseUrl, apiKey);

    if (result.success && result.models) {
      setBuiltInModels(result.models);
      setBuiltInValidationStatus('valid');

      // 默认选择第一个模型（如果尚未选择或当前选择不在列表中）
      let newSelectedModel = builtInSelectedModel;
      if (result.models.length > 0) {
        if (!builtInSelectedModel || !result.models.some(m => m.id === builtInSelectedModel)) {
          newSelectedModel = result.models[0].id;
          setBuiltInSelectedModel(newSelectedModel);
        }
      }

      // 保存到缓存
      saveBuiltInModelsCache(result.models, 'valid', newSelectedModel);
    } else {
      setBuiltInModels([]);
      setBuiltInValidationStatus('invalid');
      saveBuiltInModelsCache([], 'invalid', null);
    }
  };

  // 内置模式开启时自动验证（仅当没有有效缓存时）
  useEffect(() => {
    if (useBuiltInMode) {
      // 如果有缓存且验证成功，则不需要重新验证
      // 但如果验证状态不是 'valid'，则需要重新验证
      if (builtInValidationStatus !== 'valid') {
        refreshBuiltInModels();
      }
    }
  }, [useBuiltInMode]);
  
  // 内置配置
  const builtInConfig = useMemo<ModelConfig | null>(() => {
    if (!useBuiltInMode || !builtInSelectedModel || builtInValidationStatus !== 'valid') return null;
    
    return {
      baseUrl: getBuiltInBaseUrl(),
      apiKey: getBuiltInApiKey(),
      selectedModel: builtInSelectedModel,
    };
  }, [useBuiltInMode, builtInSelectedModel, builtInValidationStatus]);
  
  // 选择内置模型
  const selectBuiltInModel = (modelId: string) => {
    setBuiltInSelectedModel(modelId);
    // 选择模型时也保存到缓存
    saveBuiltInModelsCache(builtInModels, builtInValidationStatus, modelId);
  };

  // 根据模式返回不同的 currentModelConfig
  const currentModelConfig = useMemo(() => {
    if (useBuiltInMode) {
      return builtInConfig;
    }
    return controller.currentModelConfig;
  }, [useBuiltInMode, builtInConfig, controller.currentModelConfig]);

  // 综合忙碌状态（自定义配置验证中 或 内置配置验证中）
  const isConfigBusy = controller.isConfigBusy || builtInValidationStatus === 'validating';

  return (
    <ModelConfigContext.Provider
      value={{
        ...controller,
        currentModelConfig, // 覆盖原有的 currentModelConfig
        isConfigBusy, // 覆盖原有的 isConfigBusy
        isConfigDialogOpen,
        setIsConfigDialogOpen,
        useBuiltInMode,
        setUseBuiltInMode,
        builtInModels,
        builtInSelectedModel,
        builtInValidationStatus,
        selectBuiltInModel,
        refreshBuiltInModels,
      }}
    >
      {children}
    </ModelConfigContext.Provider>
  );
}

export function useModelConfig() {
  const context = useContext(ModelConfigContext);
  if (!context) {
    throw new Error('useModelConfig must be used within a ModelConfigProvider');
  }
  return context;
}
