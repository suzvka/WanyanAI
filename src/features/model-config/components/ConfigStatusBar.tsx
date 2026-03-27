'use client';

import { Badge } from '@/components/ui/badge';
import type { ApiConfigRecord } from '@/types/modelConfig';

function getConfigStatusLabel(status: ApiConfigRecord['lastValidationStatus']) {
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

function getConfigStatusVariant(status: ApiConfigRecord['lastValidationStatus']) {
  switch (status) {
    case 'valid':
      return 'default';
    case 'invalid':
      return 'destructive';
    default:
      return 'outline';
  }
}

type ConfigStatusBarProps = {
  selectedConfig: ApiConfigRecord | null;
  emptyMessage?: string;
};

export default function ConfigStatusBar({
  selectedConfig,
  emptyMessage = '当前尚未添加 API 配置。点击“管理配置”即可开始设置。',
}: ConfigStatusBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
      {selectedConfig ? (
        <>
          <Badge variant={getConfigStatusVariant(selectedConfig.lastValidationStatus)}>
            {getConfigStatusLabel(selectedConfig.lastValidationStatus)}
          </Badge>
          <span className="max-w-[520px] truncate">
            {selectedConfig.lastValidationMessage || `${selectedConfig.name} · 已缓存 ${selectedConfig.modelsCache.length} 个模型`}
          </span>
        </>
      ) : (
        <span>{emptyMessage}</span>
      )}
    </div>
  );
}
