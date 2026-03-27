'use client';

import type { ApiConfigRecord } from '@/types/modelConfig';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type ConfigSelectorProps = {
  configs: ApiConfigRecord[];
  selectedConfigId: string | null;
  disabled?: boolean;
  onSelect: (configId: string) => void;
};

export default function ConfigSelector({
  configs,
  selectedConfigId,
  disabled = false,
  onSelect,
}: ConfigSelectorProps) {
  return (
    <Select value={selectedConfigId || undefined} onValueChange={onSelect}>
      <SelectTrigger disabled={disabled || configs.length === 0}>
        <SelectValue placeholder={configs.length > 0 ? '切换 API 配置' : '暂无 API 配置'} />
      </SelectTrigger>
      <SelectContent>
        {configs.map((config) => (
          <SelectItem key={config.id} value={config.id}>
            {config.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
