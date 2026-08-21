'use client';

import { useState } from 'react';
import { Boxes, CircleCheck, CircleSlash, Cpu } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { ModelToggleInfo, StationInfo } from './types';

interface ModelTogglePanelProps {
  station: StationInfo;
}

/**
 * 模型启停：状态化列表。
 * - 顶部统计概览（启用数 / 总数）
 * - 每行：状态徽章（运行中=绿色 / 已停用=中性灰）+ Switch 即时保存
 */
export function ModelTogglePanel({ station }: ModelTogglePanelProps) {
  const [toggles, setToggles] = useState<ModelToggleInfo[]>(station.modelToggles);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const enabledCount = toggles.filter((t) => t.enabled).length;
  const ratio = toggles.length > 0 ? Math.round((enabledCount / toggles.length) * 100) : 0;

  const toggleModel = async (model: ModelToggleInfo, enabled: boolean) => {
    // 乐观更新
    setToggles((prev) => prev.map((t) => (t.id === model.id ? { ...t, enabled } : t)));
    setPendingIds((prev) => new Set(prev).add(model.id));

    try {
      const res = await fetch('/api/v1/admin/toggles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stationId: station.id, modelId: model.id, enabled }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || '更新失败');
        // 回滚
        setToggles((prev) => prev.map((t) => (t.id === model.id ? { ...t, enabled: !enabled } : t)));
        return;
      }

      toast.success(`模型「${model.name}」${enabled ? '已启用' : '已停用'}`);
    } catch {
      toast.error('网络错误，请重试');
      setToggles((prev) => prev.map((t) => (t.id === model.id ? { ...t, enabled: !enabled } : t)));
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(model.id);
        return next;
      });
    }
  };

  if (toggles.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-8 py-14 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Boxes className="size-5" />
        </div>
        <div>
          <p className="text-sm font-medium">无可管理的模型</p>
          <p className="mt-1 text-xs text-muted-foreground">
            该中转站未暴露模型启停能力
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* 统计概览 */}
      <div className="flex items-center justify-between rounded-2xl border bg-card px-5 py-4 shadow-card">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <Cpu className="size-4" />
          </span>
          <div>
            <p className="text-sm font-medium">运行状态</p>
            <p className="text-xs text-muted-foreground">
              {enabledCount} / {toggles.length} 个模型已启用
            </p>
          </div>
        </div>
        <div className="flex w-1/2 max-w-56 items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${ratio}%`,
                background:
                  'linear-gradient(90deg, color-mix(in oklab, var(--report-score-green) 70%, transparent), var(--report-score-green))',
              }}
            />
          </div>
          <span className="w-9 text-right text-sm font-semibold tabular-nums">{ratio}%</span>
        </div>
      </div>

      {/* 模型列表 */}
      <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
        <div className="divide-y">
          {toggles.map((model) => {
            const pending = pendingIds.has(model.id);
            return (
              <div
                key={model.id}
                className={cn(
                  'flex items-center justify-between gap-4 px-4 py-3.5 transition-colors sm:px-5',
                  model.enabled ? 'bg-card' : 'bg-muted/30'
                )}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span
                    className={cn(
                      'flex size-8 shrink-0 items-center justify-center rounded-lg border',
                      model.enabled
                        ? 'border-transparent bg-primary-soft text-primary'
                        : 'border bg-background text-muted-foreground'
                    )}
                  >
                    <Cpu className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{model.name}</p>
                      <Badge
                        variant="outline"
                        className={cn(
                          'px-1.5 py-0 text-[10px]',
                          model.enabled
                            ? 'border-transparent text-[var(--report-score-green)]'
                            : 'text-muted-foreground'
                        )}
                      >
                        <span
                          className={cn(
                            'mr-1 inline-block size-1.5 rounded-full',
                            model.enabled
                              ? 'bg-[var(--report-score-green)]'
                              : 'bg-muted-foreground'
                          )}
                        />
                        {model.enabled ? '运行中' : '已停用'}
                      </Badge>
                    </div>
                    <p className="truncate font-mono text-xs text-muted-foreground">{model.id}</p>
                    {model.description && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {model.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {pending && (
                    <CircleCheck className="size-4 animate-pulse text-muted-foreground" />
                  )}
                  <Switch
                    checked={model.enabled}
                    onCheckedChange={(checked) => toggleModel(model, checked)}
                    disabled={pending}
                    aria-label={`${model.enabled ? '停用' : '启用'} ${model.name}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CircleSlash className="size-3.5" />
        启停操作即时生效，无需额外保存
      </p>
    </div>
  );
}
