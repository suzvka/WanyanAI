'use client';

import { useMemo, useState } from 'react';
import { Check, CheckCircle2, ChevronDown, Loader2, Plus, Server, Settings, ToggleLeft, ToggleRight } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { ApiConfigDraft, ApiConfigRecord, ApiConfigValidationStatus, ModelInfo } from '@/types/modelConfig';
import ApiConfigEditor from './ApiConfigEditor';

interface ApiConfigManagerDialogProps {
  open: boolean;
  selectedConfigId: string | null;
  configs: ApiConfigRecord[];
  busy?: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectConfig: (configId: string) => Promise<void>;
  onCreateConfig: (value: ApiConfigDraft) => Promise<void> | void;
  onUpdateConfig: (configId: string, value: ApiConfigDraft) => Promise<void> | void;
  onDeleteConfig: (configId: string) => Promise<void> | void;
  // 内置模式
  useBuiltInMode: boolean;
  setUseBuiltInMode: (value: boolean) => void;
  builtInModels: ModelInfo[];
  builtInSelectedModel: string | null;
  builtInValidationStatus: ApiConfigValidationStatus;
  onSelectBuiltInModel: (modelId: string) => void;
  onRefreshBuiltInModels: () => Promise<void>;
}

function getStatusBadgeVariant(status: ApiConfigRecord['lastValidationStatus']) {
  switch (status) {
    case 'valid':
      return 'default';
    case 'invalid':
      return 'destructive';
    default:
      return 'outline';
  }
}

function getStatusLabel(status: ApiConfigRecord['lastValidationStatus']) {
  switch (status) {
    case 'valid':
      return '可用';
    case 'invalid':
      return '不可用';
    case 'validating':
      return '验证中';
    default:
      return '待验证';
  }
}

export default function ApiConfigManagerDialog({
  open,
  selectedConfigId,
  configs,
  busy = false,
  onOpenChange,
  onSelectConfig,
  onCreateConfig,
  onUpdateConfig,
  onDeleteConfig,
  // 内置模式
  useBuiltInMode,
  setUseBuiltInMode,
  builtInModels,
  builtInSelectedModel,
  builtInValidationStatus,
  onSelectBuiltInModel,
  onRefreshBuiltInModels,
}: ApiConfigManagerDialogProps) {
  // useCustomEndpoint = !useBuiltInMode（开关控制是否使用自定义端点）
  const useCustomEndpoint = !useBuiltInMode;

  // 展开的配置 ID（null 表示新建模式，undefined 表示无展开）
  const [expandedConfigId, setExpandedConfigId] = useState<string | null | undefined>(undefined);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // 当前展开的配置（null 表示新建模式）
  const expandedConfig = useMemo(() => {
    if (expandedConfigId === null) return null; // 新建模式
    if (expandedConfigId === undefined) return undefined; // 无展开
    return configs.find((config) => config.id === expandedConfigId) || undefined;
  }, [configs, expandedConfigId]);

  // 是否处于新建模式
  const isCreateMode = expandedConfigId === null;

  // 处理卡片点击（展开/折叠）
  const handleCardToggle = (configId: string) => {
    if (busy) return;
    // 如果点击的是已展开的卡片，则折叠
    setExpandedConfigId(expandedConfigId === configId ? undefined : configId);
  };

  // 处理新增块点击
  const handleAddNew = () => {
    if (busy) return;
    setExpandedConfigId(null); // 进入新建模式
  };

  // 处理选择配置（标题栏的选择按钮）
  const handleSelectConfig = async (e: React.MouseEvent, configId: string) => {
    e.stopPropagation(); // 阻止触发折叠
    if (busy) return;
    await onSelectConfig(configId);
  };

  // 处理保存按钮（编辑模式）
  const handleSave = async (value: ApiConfigDraft) => {
    if (!expandedConfig) return;
    await onUpdateConfig(expandedConfig.id, value);
    setExpandedConfigId(undefined);
  };

  // 处理删除
  const handleDeleteFromEditor = () => {
    if (!expandedConfig) return;
    setDeleteTargetId(expandedConfig.id);
  };

  // 处理删除确认
  const handleDeleteConfirm = async () => {
    if (!deleteTargetId) return;
    await onDeleteConfig(deleteTargetId);
    setDeleteTargetId(null);
    // 如果删除的是当前展开的配置，关闭展开
    if (expandedConfigId === deleteTargetId) {
      setExpandedConfigId(undefined);
    }
  };

  // 处理创建
  const handleCreate = async (value: ApiConfigDraft) => {
    await onCreateConfig(value);
    setExpandedConfigId(undefined);
  };

  // 处理关闭对话框
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && busy) {
      // 验证中允许取消
      onOpenChange(false);
      return;
    }
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setExpandedConfigId(undefined);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-lg p-0 sm:max-w-lg" showCloseButton={!busy}>
          <DialogHeader className="border-b px-4 py-4 sm:px-6">
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              API 配置管理
            </DialogTitle>
            <DialogDescription>
              {useCustomEndpoint
                ? ''
                : ''}
            </DialogDescription>
          </DialogHeader>

          {/* 端点切换开关 */}
          <div className="border-b bg-muted/30 px-4 py-3 sm:px-6">
            <button
              type="button"
              onClick={() => setUseBuiltInMode(useCustomEndpoint)}
              className={cn(
                'flex w-full items-center justify-between rounded-lg p-2 transition-colors',
                'hover:bg-muted/50'
              )}
            >
              <div className="flex items-center gap-2">
                {useCustomEndpoint ? (
                  <ToggleRight className="h-5 w-5 text-primary" />
                ) : (
                  <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                )}
                <span className="text-sm font-medium">使用自定义端点</span>
              </div>
              <span className={cn(
                'text-xs',
                useCustomEndpoint ? 'text-primary' : 'text-muted-foreground'
              )}>
                {useCustomEndpoint ? '已开启' : '已关闭'}
              </span>
            </button>
          </div>

          {/* 站内模型提示 */}
          {!useCustomEndpoint && (
            <div className="px-4 py-8 sm:px-6">
              <div className="flex flex-col items-center justify-center gap-4 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Server className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-medium">站内端点激活</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    已提供站内模型，请查看模型选择器
                    <br />
                    如需使用自定义 API 端点，请开启上方的开关。
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 验证中的遮罩层 */}
          {busy && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">正在验证配置...</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenChange(false)}
                >
                  取消
                </Button>
              </div>
            </div>
          )}

          {/* 自定义端点配置列表 */}
          {useCustomEndpoint && (
            <ScrollArea className="h-[60vh] max-h-[560px] px-4 py-4 sm:px-6">
            <div className="space-y-3">
              {configs.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                  还没有 API 配置，请点击下方新增。
                </div>
              ) : (
                configs.map((config) => {
                  const isExpanded = expandedConfigId === config.id;
                  const isActive = selectedConfigId === config.id;

                  return (
                    <Collapsible
                      key={config.id}
                      open={isExpanded}
                      onOpenChange={() => handleCardToggle(config.id)}
                      className={cn(
                        'rounded-lg border bg-card transition-colors',
                        // 已选配置的脉冲动画效果
                        isActive && 'api-config-selected',
                      )}
                    >
                      {/* 卡片头部 */}
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          disabled={busy}
                          className={cn(
                            'flex w-full items-center gap-3 p-4 text-left transition-colors',
                            'hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50',
                            // 激活状态的卡片使用特殊样式
                            isActive && 'bg-primary/5 ring-1 ring-primary/30',
                            isExpanded && 'border-b',
                          )}
                        >
                          {/* 展开箭头 */}
                          <ChevronDown
                            className={cn(
                              'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                              isExpanded && 'rotate-180',
                            )}
                          />

                          {/* 卡片内容 */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-medium">
                                {config.name}
                              </span>
                              {/* 激活标记 */}
                              {isActive && (
                                <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                              )}
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="max-w-[120px] truncate">{config.baseUrl}</span>
                              <span>·</span>
                              <Badge
                                variant={getStatusBadgeVariant(config.lastValidationStatus)}
                                className="shrink-0 px-1.5 py-0 text-[10px]"
                              >
                                {getStatusLabel(config.lastValidationStatus)}
                              </Badge>
                              <span>·</span>
                              <span className="shrink-0 whitespace-nowrap">{config.modelsCache.length} 个模型</span>
                            </div>
                          </div>

                          {/* 选择配置按钮 - 仅在非激活状态显示 */}
                          {!isActive && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className={cn(
                                'h-8 w-8 shrink-0',
                                'text-primary hover:bg-primary/10 hover:text-primary',
                              )}
                              disabled={busy}
                              onClick={(e) => handleSelectConfig(e, config.id)}
                              title="选择此配置"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          )}
                        </button>
                      </CollapsibleTrigger>

                      {/* 展开内容 - 动画由全局 CSS 控制 */}
                      <CollapsibleContent>
                        <div className="bg-muted/20 p-4">
                          <ApiConfigEditor
                            initialValue={{
                              name: config.name,
                              baseUrl: config.baseUrl,
                              apiKey: config.apiKey,
                            }}
                            busy={busy}
                            submitLabel="保存"
                            showDelete
                            onDelete={handleDeleteFromEditor}
                            onSubmit={handleSave}
                          />
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })
              )}

              {/* 新增块 */}
              <button
                type="button"
                disabled={busy}
                onClick={handleAddNew}
                className={cn(
                  'flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed',
                  'border-border bg-muted/20 p-4 text-muted-foreground transition-colors',
                  'hover:border-primary/50 hover:bg-muted/40 hover:text-foreground',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  isCreateMode && 'border-primary/50 bg-primary/5 text-foreground',
                )}
              >
                <Plus className="h-5 w-5" />
                <span className="text-sm">新增配置</span>
              </button>

              {/* 新建配置展开区域 */}
              {isCreateMode && (
                <div className="rounded-lg border bg-card p-4">
                  <h4 className="mb-3 text-sm font-medium">新建 API 配置</h4>
                  <ApiConfigEditor
                    busy={busy}
                    submitLabel="创建并验证"
                    onSubmit={handleCreate}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full"
                    disabled={busy}
                    onClick={() => setExpandedConfigId(undefined)}
                  >
                    取消
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <AlertDialog
        open={deleteTargetId !== null}
        onOpenChange={(nextOpen: boolean) => !nextOpen && setDeleteTargetId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除该 API 配置？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后仅会清理当前浏览器中的本地缓存，不会影响远端服务。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={busy}
              onClick={handleDeleteConfirm}
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
