'use client';

import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ApiConfigRecord, ModelInfo } from '@/types/modelConfig';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

type ModelSelectorProps = {
  selectedConfig: ApiConfigRecord | null;
  disabled?: boolean;
  className?: string;
  onSelectModel: (modelId: string) => void;
  // 内置模式支持
  useBuiltInMode?: boolean;
  builtInModels?: ModelInfo[];
  builtInSelectedModel?: string | null;
  onSelectBuiltInModel?: (modelId: string) => void;
  // 刷新功能
  isRefreshing?: boolean;
  onRefresh?: () => void;
};

export default function ModelSelector({
  selectedConfig,
  disabled = false,
  className,
  onSelectModel,
  // 内置模式参数
  useBuiltInMode = false,
  builtInModels = [],
  builtInSelectedModel = null,
  onSelectBuiltInModel,
  // 刷新参数
  isRefreshing = false,
  onRefresh,
}: ModelSelectorProps) {
  // 根据模式选择数据源
  const models = useBuiltInMode ? builtInModels : (selectedConfig?.modelsCache || []);
  const selectedModel = useBuiltInMode ? builtInSelectedModel : (selectedConfig?.selectedModel || null);
  const handleSelect = useBuiltInMode ? (onSelectBuiltInModel || (() => {})) : onSelectModel;

  // 判断是否有可用模型
  const hasModels = models.length > 0;
  const isDisabled = disabled || isRefreshing || (useBuiltInMode ? !hasModels : (!selectedConfig || !hasModels));

  // 生成占位文本
  const placeholder = isRefreshing
    ? '正在刷新模型列表...'
    : (useBuiltInMode
      ? (hasModels ? '请选择一个模型' : '正在加载模型列表...')
      : (selectedConfig ? '请选择一个模型' : '请先选择 API 配置'));

  // 生成状态提示文本
  const getStatusText = () => {
    if (!useBuiltInMode) return null;
    if (hasModels) return null;
    if (isRefreshing) return null;

    return '加载失败，请点击刷新按钮重试';
  };

  return (
    <Select value={selectedModel || ''} onValueChange={handleSelect}>
      <SelectTrigger
        className={cn('w-[180px]', className)}
        disabled={isDisabled}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent
        header={
          onRefresh ? (
            <div className="bg-muted/50 border-b border-border p-2">
              <div className="flex items-center justify-between mb-1.5 px-1">
                <div className="text-muted-foreground text-xs font-medium">操作</div>
                {!hasModels && !isRefreshing && (
                  <div className="text-destructive text-xs">{getStatusText()}</div>
                )}
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="w-full justify-start gap-2 text-xs"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onRefresh();
                }}
                disabled={isRefreshing}
              >
                <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
                {isRefreshing ? '正在刷新...' : '刷新模型列表'}
              </Button>
            </div>
          ) : undefined
        }
      >
        {/* 模型列表 */}
        {models.map((model) => (
          <SelectItem key={model.id} value={model.id} className="max-w-[280px]">
            <span className="truncate">{model.name}</span>
          </SelectItem>
        ))}
        {models.length === 0 && !isRefreshing && (
          <div className="px-2 py-4 text-center">
            <div className="text-sm text-muted-foreground mb-2">暂无可用模型</div>
            {getStatusText() && (
              <div className="text-xs text-destructive">{getStatusText()}</div>
            )}
          </div>
        )}
      </SelectContent>
    </Select>
  );
}