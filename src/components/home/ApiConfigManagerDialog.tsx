'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Plus, Settings, Trash2 } from 'lucide-react';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { ApiConfigDraft, ApiConfigRecord } from '@/types/modelConfig';
import ApiConfigEditor from './ApiConfigEditor';

interface ApiConfigManagerDialogProps {
  open: boolean;
  selectedConfigId: string | null;
  configs: ApiConfigRecord[];
  busy?: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectConfig: (configId: string) => void;
  onCreateConfig: (value: ApiConfigDraft) => Promise<void> | void;
  onUpdateConfig: (configId: string, value: ApiConfigDraft) => Promise<void> | void;
  onDeleteConfig: (configId: string) => Promise<void> | void;
}

type EditorMode = 'create' | 'edit';

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
}: ApiConfigManagerDialogProps) {
  const [editorMode, setEditorMode] = useState<EditorMode>('edit');
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const selectedConfig = useMemo(() => {
    return configs.find((config) => config.id === selectedConfigId) || null;
  }, [configs, selectedConfigId]);

  const editingConfig = editorMode === 'edit' ? selectedConfig : null;

  const handleCreate = async (value: ApiConfigDraft) => {
    await onCreateConfig(value);
    setEditorMode('edit');
  };

  const handleUpdate = async (value: ApiConfigDraft) => {
    if (!editingConfig) {
      return;
    }

    await onUpdateConfig(editingConfig.id, value);
  };

  const handleDelete = async () => {
    if (!deleteTargetId) {
      return;
    }

    await onDeleteConfig(deleteTargetId);
    setDeleteTargetId(null);
    if (configs.length <= 1) {
      setEditorMode('create');
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl p-0 sm:max-w-5xl" showCloseButton={!busy}>
          <DialogHeader className="border-b px-6 pt-6">
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              API 配置管理
            </DialogTitle>
            <DialogDescription>本地保存多个 API 配置，支持切换、编辑、删除，并在切换后自动刷新模型列表。</DialogDescription>
          </DialogHeader>

          <div className="grid min-h-[560px] gap-0 md:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="border-r bg-slate-50/70">
              <div className="flex items-center justify-between px-4 py-4">
                <div>
                  <div className="text-sm font-medium text-slate-900">配置列表</div>
                  <div className="text-xs text-slate-500">名称允许重复，系统按 ID 区分。</div>
                </div>
                <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setEditorMode('create')}>
                  <Plus className="mr-1 h-4 w-4" />
                  新建
                </Button>
              </div>

              <ScrollArea className="h-[480px] px-3 pb-4">
                <div className="space-y-2">
                  {configs.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">
                      还没有 API 配置，请先新建一条。
                    </div>
                  ) : (
                    configs.map((config) => (
                      <button
                        key={config.id}
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          onSelectConfig(config.id);
                          setEditorMode('edit');
                        }}
                        className={cn(
                          'w-full rounded-lg border bg-white p-3 text-left transition hover:border-slate-300 hover:bg-slate-100',
                          selectedConfigId === config.id && 'border-blue-500 bg-blue-50',
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 space-y-1">
                            <div className="truncate text-sm font-medium text-slate-900">{config.name}</div>
                            <div className="truncate text-xs text-slate-500">{config.baseUrl}</div>
                          </div>
                          {selectedConfigId === config.id && <CheckCircle2 className="mt-0.5 h-4 w-4 text-blue-600" />}
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Badge variant={getStatusBadgeVariant(config.lastValidationStatus)}>{getStatusLabel(config.lastValidationStatus)}</Badge>
                          <span className="text-xs text-slate-500">模型 {config.modelsCache.length} 个</span>
                        </div>
                        {config.lastValidationMessage && (
                          <div className="mt-2 line-clamp-2 text-xs text-slate-500">{config.lastValidationMessage}</div>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </aside>

            <section className="flex h-full flex-col px-6 py-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">{editingConfig ? '编辑配置' : '新建配置'}</h3>
                  <p className="text-sm text-slate-500">
                    {editingConfig
                      ? '保存后将重新校验该配置，并刷新当前可用模型列表。'
                      : '保存后将自动选中并立即校验这条新配置。'}
                  </p>
                </div>
                {editingConfig && (
                  <Button type="button" variant="ghost" className="text-red-600 hover:text-red-700" disabled={busy} onClick={() => setDeleteTargetId(editingConfig.id)}>
                    <Trash2 className="mr-1 h-4 w-4" />
                    删除
                  </Button>
                )}
              </div>

              <ApiConfigEditor
                initialValue={
                  editingConfig
                    ? {
                        name: editingConfig.name,
                        baseUrl: editingConfig.baseUrl,
                        apiKey: editingConfig.apiKey,
                      }
                    : undefined
                }
                busy={busy}
                submitLabel={editingConfig ? '保存并重新校验' : '创建并立即校验'}
                onSubmit={editingConfig ? handleUpdate : handleCreate}
              />
            </section>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTargetId !== null} onOpenChange={(nextOpen: boolean) => !nextOpen && setDeleteTargetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除该 API 配置？</AlertDialogTitle>
            <AlertDialogDescription>删除后仅会清理当前浏览器中的本地缓存，不会影响远端服务。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>取消</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" disabled={busy} onClick={handleDelete}>
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
