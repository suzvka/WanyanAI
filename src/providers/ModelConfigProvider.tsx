'use client';

import { createContext, useContext, useState, useMemo, useEffect, useRef, ReactNode } from 'react';
import { toast } from 'sonner';
import { useModelConfigController } from '@/features/model-config/hooks/useModelConfigController';
import { modelConfigProvider } from '@/services/modelConfig/provider';
import {
    getBuiltInApiKey,
    getBuiltInBaseUrl,
    getBuiltInModelsCache,
    saveBuiltInModelsCache,
    clearBuiltInModelsCache,
    clearBuiltInApiKey,
    refreshBuiltInApiKey,
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

    // 使用 ref 追踪是否正在刷新，避免 useEffect 循环触发
    const isRefreshingRef = useRef(false);
    const retryCountRef = useRef(0);
    const MAX_RETRY_COUNT = 3;

    // 重试计数器
    const [retryCount, setRetryCount] = useState(0);

    // 内置模式的模型列表、选择和验证状态（与自定义配置一致）
    const [builtInModels, setBuiltInModels] = useState<ModelInfo[]>(() => {
        const cache = getBuiltInModelsCache();
        // 如果缓存无效（没有模型或状态不是 valid），返回空数组
        return cache?.models && cache.validationStatus === 'valid' ? cache.models : [];
    });
    const [builtInSelectedModel, setBuiltInSelectedModel] = useState<string | null>(() => {
        const cache = getBuiltInModelsCache();
        // 只在缓存有效时恢复选择
        return cache?.models && cache.validationStatus === 'valid' ? (cache.selectedModel || null) : null;
    });
    const [builtInValidationStatus, setBuiltInValidationStatus] = useState<ApiConfigValidationStatus>(() => {
        const cache = getBuiltInModelsCache();
        // 如果缓存无效（没有模型），状态设为 unknown 以触发刷新
        return cache?.models && cache.validationStatus === 'valid' ? cache.validationStatus : 'unknown';
    });

    // 使用与自定义配置相同的验证逻辑获取内置模型列表
    const refreshBuiltInModels = async (currentRetry: number = 0, isManualRetry: boolean = false) => {
        // 如果正在刷新且不是手动重试，直接返回
        if (isRefreshingRef.current && !isManualRetry) {
            return;
        }

        // 标记为正在刷新
        isRefreshingRef.current = true;

        // 更新重试计数
        setRetryCount(currentRetry);
        retryCountRef.current = currentRetry;

        // 立即显示刷新动画
        setBuiltInValidationStatus('validating');

        // 延迟1秒后执行实际刷新（重试时延迟更短）
        await new Promise(resolve => setTimeout(resolve, currentRetry > 0 ? 500 : 1000));

        // 如果是重试，清除所有相关缓存，确保获取最新数据
        if (currentRetry > 0) {
            clearBuiltInApiKey();
            clearBuiltInModelsCache();
        } else {
            // 初次刷新时只清除模型缓存
            clearBuiltInModelsCache();
        }

        const baseUrl = getBuiltInBaseUrl();
        if (!baseUrl) {
            setBuiltInValidationStatus('invalid');
            saveBuiltInModelsCache([], 'invalid', null);
            isRefreshingRef.current = false;
            toast.error('刷新失败', {
                description: '缺少必要的配置信息',
            });
            return;
        }

        let apiKey = getBuiltInApiKey();
        if (!apiKey) {
            try {
                const issued = await refreshBuiltInApiKey();
                apiKey = issued.key;
            } catch (error) {
                setBuiltInValidationStatus('invalid');
                saveBuiltInModelsCache([], 'invalid', null);
                isRefreshingRef.current = false;

                // 检查是否需要重试
                if (currentRetry < MAX_RETRY_COUNT) {
                    const nextRetry = currentRetry + 1;
                    toast.warning('正在重试...', {
                        description: `连接失败，将在 ${0.5 * nextRetry} 秒后自动重试（${nextRetry}/${MAX_RETRY_COUNT}）`,
                    });
                    setTimeout(() => {
                        isRefreshingRef.current = false;
                        refreshBuiltInModels(nextRetry, true);
                    }, 500 * nextRetry);
                } else {
                    toast.error('刷新失败', {
                        description: error instanceof Error ? error.message : '站内代理 Key 获取失败，请刷新页面重试',
                    });
                    // 重试次数用完，清除所有无效缓存
                    clearBuiltInApiKey();
                    clearBuiltInModelsCache();
                    setBuiltInValidationStatus('unknown');
                    setRetryCount(0);
                    retryCountRef.current = 0;
                }
                return;
            }
        }

        const result = await modelConfigProvider.validateAndFetchModels(baseUrl, apiKey);

        if (result.success && result.models) {
            setBuiltInModels(result.models);
            setBuiltInValidationStatus('valid');
            setRetryCount(0);
            retryCountRef.current = 0;
            isRefreshingRef.current = false;

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

            // 刷新成功提示（如果不是重试）
            if (currentRetry === 0) {
                toast.success('刷新完成', {
                    description: `成功获取 ${result.models.length} 个模型`,
                });
            }
        } else {
            setBuiltInModels([]);
            setBuiltInValidationStatus('invalid');
            saveBuiltInModelsCache([], 'invalid', null);
            isRefreshingRef.current = false;

            // 检查是否需要重试
            if (currentRetry < MAX_RETRY_COUNT) {
                const nextRetry = currentRetry + 1;
                toast.warning('正在重试...', {
                    description: `加载失败，将在 ${0.5 * nextRetry} 秒后自动重试（${nextRetry}/${MAX_RETRY_COUNT}）`,
                });
                setTimeout(() => {
                    isRefreshingRef.current = false;
                    refreshBuiltInModels(nextRetry, true);
                }, 500 * nextRetry);
            } else {
                // 刷新失败提示
                const errorMessage = typeof result.error === 'string'
                    ? result.error
                    : result.error?.message || '无法获取模型列表';
                toast.error('刷新失败', {
                    description: `${errorMessage}，请刷新页面重试`,
                });
                // 重试次数用完，清除所有无效缓存
                clearBuiltInApiKey();
                clearBuiltInModelsCache();
                setBuiltInValidationStatus('unknown');
                setRetryCount(0);
                retryCountRef.current = 0;
            }
        }
    };

    // 内置模式开启时自动验证和恢复
    // 只在组件挂载时或模式切换时触发一次，避免循环
    useEffect(() => {
        if (!useBuiltInMode) {
            return;
        }

        // 如果正在刷新，不触发
        if (isRefreshingRef.current) {
            return;
        }

        // 如果已经成功加载，不触发
        if (builtInValidationStatus === 'valid' && builtInModels.length > 0) {
            return;
        }

        // 如果正在验证中，不触发
        if (builtInValidationStatus === 'validating') {
            return;
        }

        // 触发刷新
        refreshBuiltInModels(0);

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [useBuiltInMode]); // 只在 useBuiltInMode 变化时触发

    // 内置配置
    const builtInConfig = useMemo<ModelConfig | null>(() => {
        const apiKey = getBuiltInApiKey();
        if (!useBuiltInMode || !builtInSelectedModel || builtInValidationStatus !== 'valid' || !apiKey) {
            return null;
        }

        return {
            baseUrl: getBuiltInBaseUrl(),
            apiKey,
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
