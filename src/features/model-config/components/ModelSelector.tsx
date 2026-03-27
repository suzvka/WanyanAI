'use client';

import type { ApiConfigRecord } from '@/types/modelConfig';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type ModelSelectorProps = {
  selectedConfig: ApiConfigRecord | null;
  disabled?: boolean;
  onSelectModel: (modelId: string) => void;
};

export default function ModelSelector({
  selectedConfig,
  disabled = false,
  onSelectModel,
}: ModelSelectorProps) {
  return (
    <Select value={selectedConfig?.selectedModel || undefined} onValueChange={onSelectModel}>
      <SelectTrigger disabled={disabled || !selectedConfig || selectedConfig.modelsCache.length === 0}>
        <SelectValue placeholder={selectedConfig ? '请选择一个模型' : '请先选择 API 配置'} />
      </SelectTrigger>
      <SelectContent>
        {(selectedConfig?.modelsCache || []).map((model) => (
          <SelectItem key={model.id} value={model.id}>
            {model.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
