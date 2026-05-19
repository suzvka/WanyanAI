/**
 * select-control 渲染器
 *
 * 紧凑布局：Label 与 Select 水平排列，减少垂直空间占用
 */

'use client';

import { useMemo } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { ControlDefinition } from '@/features/controls/types';
import type { SelectOption } from './types';

interface SelectControlRendererProps {
  definition: ControlDefinition;
  value: string;
  onChange: (controlId: string, value: string) => void;
  disabled?: boolean;
}

/**
 * 下拉选择控件渲染器 —— 紧凑水平布局
 */
export function SelectControlRenderer({
  definition,
  value,
  onChange,
  disabled,
}: SelectControlRendererProps) {
  const data = definition.data as { options?: SelectOption[] };

  const rawOptions = data?.options ?? [];

  // 归一化选项：value 默认 fallback 为 label，默认 enabled
  const options = rawOptions.map((o) => ({
    value: o.value ?? o.label,
    label: o.label,
    enabled: o.enabled !== false,
    defaultSelected: o.defaultSelected,
  }));

  // 默认选项：优先 defaultSelected，其次首个 enabled 项
  const defaultOption = options.find((o) => o.defaultSelected) ?? options.find((o) => o.enabled);

  // 解析当前值对应的 label 显示（value 存储的是 label 时也能正确匹配）
  const resolvedValue = value || defaultOption?.value;

  return (
    <div className="flex items-center gap-3">
      {definition.title && (
        <Label className="text-sm font-medium text-[color:var(--report-text-heading)] shrink-0 whitespace-nowrap">
          {definition.title}
        </Label>
      )}
      <Select
        value={resolvedValue}
        onValueChange={(newValue) => onChange(definition.id, newValue)}
        disabled={disabled}
      >
        <SelectTrigger className="w-full min-w-[140px] max-w-[240px]">
          <SelectValue placeholder="请选择" />
        </SelectTrigger>
        <SelectContent>
          {options
            .filter((o) => o.enabled)
            .map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
      {definition.description && (
        <span className="text-xs text-muted-foreground shrink-0">{definition.description}</span>
      )}
    </div>
  );
}

/**
 * 从控件定义数组中筛选 select 类型
 */
export function filterSelectControls(
  definitions: ControlDefinition[],
): ControlDefinition[] {
  return definitions.filter((d) => d.type === 'select');
}
