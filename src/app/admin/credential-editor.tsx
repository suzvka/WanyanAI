'use client';

import { useState } from 'react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ChevronDown, CircleAlert, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { CredentialField, StationInfo } from './types';

interface CredentialEditorProps {
  station: StationInfo;
}

const inputType = (field: CredentialField): string =>
  field.type === 'password' ? 'password' : 'text';

/**
 * 凭证配置：以「模型集合」为心智模型。
 * - 每个模型一张可折叠卡片，字段表单两列栅格
 * - Dialog 添加模型、AlertDialog 确认删除
 * - 底部 Sticky 浮动保存栏，未保存时显示提示
 */
export function CredentialEditor({ station }: CredentialEditorProps) {
  const [credentials, setCredentials] = useState<CredentialField[]>(station.credentials);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(station.credentials.map((c) => [c.key, true]))
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newModelId, setNewModelId] = useState('');
  const [addError, setAddError] = useState('');
  const [pendingRemove, setPendingRemove] = useState<CredentialField | null>(null);

  // ---- 添加模型 ----

  const openAddDialog = () => {
    setNewModelId('');
    setAddError('');
    setAddOpen(true);
  };

  const confirmAdd = () => {
    const id = newModelId.trim();
    if (!id) {
      setAddError('请输入模型标识');
      return;
    }
    if (credentials.some((c) => c.key === id)) {
      setAddError(`模型 "${id}" 已存在，请勿重复添加`);
      return;
    }

    const created: CredentialField = {
      key: id,
      label: id,
      type: 'group',
      required: false,
      // schema 中的 id 字段是模型标识（即本条目的 key），不作为子字段渲染
      children: station.credentialSchema
        .filter((s) => s.key !== 'id')
        .map((s) => ({
          key: s.key,
          label: s.label,
          type: s.type,
          required: s.required,
          value: '',
        })),
    };

    setCredentials((prev) => [...prev, created]);
    setExpanded((prev) => ({ ...prev, [id]: true }));
    setDirty(true);
    setAddOpen(false);
    toast.success(`已添加模型 "${id}"，填写配置后点击保存`);
  };

  // ---- 删除模型 ----

  const confirmRemove = () => {
    if (!pendingRemove) return;
    setCredentials((prev) => prev.filter((c) => c.key !== pendingRemove.key));
    setExpanded((prev) => {
      const next = { ...prev };
      delete next[pendingRemove.key];
      return next;
    });
    toast.info(`模型 "${pendingRemove.key}" 已移除，点击保存生效`);
    setPendingRemove(null);
    setDirty(true);
  };

  // ---- 编辑字段 ----

  const updateChildValue = (modelKey: string, childKey: string, value: string) => {
    setCredentials((prev) =>
      prev.map((cred) => {
        if (cred.key !== modelKey) return cred;
        return {
          ...cred,
          children: (cred.children || []).map((child) =>
            child.key === childKey ? { ...child, value } : child
          ),
        };
      })
    );
    setDirty(true);
  };

  const toggleExpanded = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // ---- 保存 ----

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/v1/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stationId: station.id, credentials }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || '保存失败');
        return;
      }

      setDirty(false);
      toast.success('配置已保存，将立即生效');
    } catch {
      toast.error('网络错误，请重试');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 工具栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>共 {credentials.length} 个模型</span>
          {dirty && (
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <CircleAlert className="size-3.5" />
              有未保存的修改
            </span>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={openAddDialog}>
          <Plus />
          添加模型
        </Button>
      </div>

      {/* 模型列表 */}
      {credentials.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-8 py-14 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Plus className="size-5" />
          </div>
          <div>
            <p className="text-sm font-medium">暂无模型配置</p>
            <p className="mt-1 text-xs text-muted-foreground">
              点击「添加模型」创建第一个模型凭证
            </p>
          </div>
          <Button size="sm" onClick={openAddDialog}>
            <Plus />
            添加模型
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {credentials.map((cred) => {
            const isOpen = expanded[cred.key] !== false;
            return (
              <Collapsible
                key={cred.key}
                open={isOpen}
                onOpenChange={() => toggleExpanded(cred.key)}
              >
                <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
                  <div className="flex items-stretch justify-between gap-1 pr-2 sm:pr-3">
                    {/* 可点击展开区域（CollapsibleTrigger） */}
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-accent/50 sm:px-5"
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background text-muted-foreground">
                          <span className="font-mono text-xs font-semibold">
                            {cred.key.slice(0, 2).toUpperCase()}
                          </span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-mono text-sm font-medium">
                            {cred.key}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {(cred.children || []).length} 个配置字段
                          </span>
                        </span>
                        <ChevronDown
                          className={cn(
                            'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
                            isOpen && 'rotate-180'
                          )}
                        />
                      </button>
                    </CollapsibleTrigger>

                    {/* 操作区（独立于 Trigger，避免 button 嵌套） */}
                    <div className="flex shrink-0 items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:text-destructive"
                        aria-label={`删除模型 ${cred.key}`}
                        onClick={() => setPendingRemove(cred)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>

                  <CollapsibleContent>
                    <Separator />
                    <div className="grid grid-cols-1 gap-4 px-4 py-4 sm:px-5 md:grid-cols-2">
                      {(cred.children || []).map((child) => (
                        <div key={child.key} className="space-y-1.5">
                          <Label className="text-xs font-medium">
                            {child.label}
                            {child.required && <span className="ml-0.5 text-destructive">*</span>}
                          </Label>
                          <Input
                            type={inputType(child)}
                            placeholder={child.label}
                            value={child.value ?? ''}
                            onChange={(e) => updateChildValue(cred.key, child.key, e.target.value)}
                            autoComplete="off"
                          />
                          {child.description && (
                            <p className="text-xs text-muted-foreground">{child.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
        </div>
      )}

      {/* 删除确认 */}
      <AlertDialog
        open={pendingRemove !== null}
        onOpenChange={(open) => !open && setPendingRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>移除模型配置</AlertDialogTitle>
            <AlertDialogDescription>
              确定移除模型 "{pendingRemove?.key}" 的配置？此操作不会立即生效，
              点击保存后才会写入。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-primary-foreground hover:bg-destructive/90"
              onClick={confirmRemove}
            >
              移除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 添加模型 Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>添加模型</DialogTitle>
            <DialogDescription>
              输入模型标识（如 deepseek-chat），添加后填写对应的凭证字段。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="new-model-id" className="text-xs font-medium">
              模型标识
            </Label>
            <Input
              id="new-model-id"
              placeholder="deepseek-chat"
              value={newModelId}
              onChange={(e) => {
                setNewModelId(e.target.value);
                setAddError('');
              }}
              onKeyDown={(e) => e.key === 'Enter' && confirmAdd()}
              autoFocus
            />
            {addError && <p className="text-xs text-destructive">{addError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              取消
            </Button>
            <Button onClick={confirmAdd} disabled={!newModelId.trim()}>
              添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sticky 浮动保存栏 */}
      {credentials.length > 0 && (
        <div className="sticky bottom-4 z-10">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-popover/95 px-4 py-3 shadow-pop backdrop-blur">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant={dirty ? 'default' : 'outline'}>
                {dirty ? '有未保存的修改' : '已保存'}
              </Badge>
              <span className="hidden sm:inline">
                修改在点击保存后统一写入并立即生效
              </span>
            </div>
            <Button onClick={handleSave} disabled={saving}>
              <Save />
              {saving ? '保存中...' : '保存配置'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
