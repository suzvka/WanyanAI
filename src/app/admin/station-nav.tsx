'use client';

import { KeyRound, Power, ServerCog } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StationInfo } from './types';

interface StationNavProps {
  stations: StationInfo[];
  activeStationId: string | null;
  onSelect: (id: string) => void;
}

/**
 * 左侧站点导航：以「对象」呈现每个中转站，高亮当前项。
 */
export function StationNav({ stations, activeStationId, onSelect }: StationNavProps) {
  return (
    <nav className="flex flex-col gap-1">
      {stations.map((station) => {
        const active = station.id === activeStationId;
        const capabilities: Array<'credential' | 'toggle'> = [];
        if (station.hasCredentialConfig) capabilities.push('credential');
        if (station.hasModelToggle) capabilities.push('toggle');

        return (
          <button
            key={station.id}
            type="button"
            onClick={() => onSelect(station.id)}
            className={cn(
              'group flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left transition-colors',
              active
                ? 'border-primary-border bg-primary-soft text-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            <span
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-lg border transition-colors',
                active
                  ? 'border-transparent bg-primary text-primary-foreground shadow-sm'
                  : 'border bg-background text-muted-foreground group-hover:bg-background'
              )}
            >
              <ServerCog className="size-4" />
            </span>

            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{station.name}</span>
              <span className="mt-0.5 flex items-center gap-1.5">
                {capabilities.length > 0 ? (
                  capabilities.map((cap) =>
                    cap === 'credential' ? (
                      <span
                        key="credential"
                        className="flex items-center gap-1 text-[10px] text-muted-foreground"
                      >
                        <KeyRound className="size-2.5" />
                        凭证
                      </span>
                    ) : (
                      <span
                        key="toggle"
                        className="flex items-center gap-1 text-[10px] text-muted-foreground"
                      >
                        <Power className="size-2.5" />
                        启停
                      </span>
                    )
                  )
                ) : (
                  <span className="text-[10px] text-muted-foreground/70">只读</span>
                )}
              </span>
            </span>

            {/* 活动指示点 */}
            <span
              className={cn(
                'size-1.5 shrink-0 rounded-full transition-colors',
                active ? 'bg-primary' : 'bg-muted-foreground/30 group-hover:bg-muted-foreground/50'
              )}
            />
          </button>
        );
      })}
    </nav>
  );
}
