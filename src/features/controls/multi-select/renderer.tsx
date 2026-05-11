'use client';

import { useCallback, useMemo } from 'react';
import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ControlDefinition } from '../types';
import type { MultiSelectConfig, MultiSelectOption } from './types';

type MultiSelectRendererProps = {
  definition: ControlDefinition;
  value: string;
  onChange: (controlId: string, value: string) => void;
  disabled?: boolean;
};

/**
 * 将逗号分隔的字符串解析为选中项集合
 */
function parseValue(value: string): Set<string> {
  if (!value) return new Set();
  return new Set(value.split(',').map((s) => s.trim()).filter(Boolean));
}

/**
 * 将选中项集合序列化为逗号分隔字符串
 */
function serializeValue(selected: Set<string>): string {
  return Array.from(selected).join(',');
}

/**
 * 多选控件渲染器（纯受控组件）
 *
 * 设计原则：
 * - 零副作用：无 useEffect、无 useRef、无默认值回写逻辑
 * - 默认值由数据层（resolveInitialControlSelections）在初始化时一次性解析
 * - 渲染器只负责：读取 value → 显示 UI → onChange 通知父组件
 */
export function MultiSelectRenderer({
  definition,
  value,
  onChange,
  disabled = false,
}: MultiSelectRendererProps) {
  const config = definition.data as unknown as MultiSelectConfig;
  const options: MultiSelectOption[] = config.options ?? [];

  const maxSelections = config.maxSelections ?? 0;

  // 纯粹从 props.value 派生，没有任何 fallback 或副作用
  const selectedSet = useMemo(() => parseValue(value), [value]);
  const selectedCount = selectedSet.size;
  const isAtLimit = maxSelections > 0 && selectedCount >= maxSelections;

  const handleToggle = useCallback(
    (label: string) => {
      if (disabled) return;

      const isSelected = selectedSet.has(label);

      // 达到上限时仅阻止新增选择，允许取消已选项
      if (!isSelected && isAtLimit) return;

      const next = new Set(selectedSet);

      if (isSelected) {
        next.delete(label);
      } else {
        next.add(label);
      }

      onChange(definition.id, serializeValue(next));
    },
    [disabled, selectedSet, isAtLimit, definition.id, onChange],
  );

  return (
    <div className="space-y-2">
      {/* 标题行 + 计数提示 */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-[color:var(--report-text-heading)] leading-relaxed">
          {definition.title}
        </span>
        {maxSelections > 0 && (
          <span
            className={cn(
              'text-xs tabular-nums leading-relaxed shrink-0',
              isAtLimit
                ? 'text-amber-600 dark:text-amber-400 font-medium'
                : 'text-muted-foreground',
            )}
          >
            已选 {selectedCount}/{maxSelections} 项{isAtLimit ? '（已达上限）' : ''}
          </span>
        )}
      </div>

      {/* Tag / Pill 横向排列 */}
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isSelected = selectedSet.has(option.label);
          const isDisabledOption = !isSelected && isAtLimit;

          return (
            <button
              key={option.label}
              type="button"
              role="checkbox"
              aria-checked={isSelected}
              aria-disabled={disabled || isDisabledOption}
              onClick={() => handleToggle(option.label)}
              disabled={disabled || isDisabledOption}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 cursor-pointer select-none border',
                isSelected
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm hover:bg-primary/90 active:scale-[0.97]'
                  : isDisabledOption
                    ? 'bg-muted/50 text-muted-foreground/50 border-border cursor-not-allowed opacity-60'
                    : 'bg-transparent text-[color:var(--report-text-body)] border-border/70 hover:border-primary/40 hover:text-primary hover:bg-primary/5 active:scale-[0.97]',
              )}
            >
              {/* 图标 */}
              <span
                className={cn(
                  'flex items-center justify-center w-4 h-4 rounded-[3px] transition-colors duration-150',
                  isSelected
                    ? 'bg-white/25 text-primary-foreground'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {isSelected ? (
                  <Check className="w-2.5 h-2.5" strokeWidth={3} />
                ) : (
                  <Minus className="w-2 h-2" strokeWidth={2.5} />
                )}
              </span>

              {/* 标签文本 */}
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
