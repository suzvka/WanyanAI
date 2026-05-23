'use client';

import { ChangeEvent, useEffect, useState } from 'react';
import { AlertCircle, Key, Link2, PencilLine, Save, Trash2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { validateApiConfigDraft } from '@/lib/validation/modelConfig';
import type { ApiConfigDraft } from '@/types/modelConfig';

interface ApiConfigEditorProps {
  initialValue?: ApiConfigDraft;
  submitLabel?: string;
  busy?: boolean;
  showDelete?: boolean;
  onDelete?: () => void;
  onSubmit: (value: ApiConfigDraft) => Promise<void> | void;
}

const emptyDraft: ApiConfigDraft = {
  name: '',
  baseUrl: '',
  apiKey: '',
};

export default function ApiConfigEditor({
  initialValue,
  submitLabel = '保存配置',
  busy = false,
  showDelete = false,
  onDelete,
  onSubmit,
}: ApiConfigEditorProps) {
  const [draft, setDraft] = useState<ApiConfigDraft>(initialValue || emptyDraft);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(initialValue || emptyDraft);
    setError(null);
  }, [initialValue]);

  const handleSubmit = async () => {
    const result = validateApiConfigDraft(draft);
    if (!result.success) {
      setError(result.error);
      return;
    }

    setError(null);
    await onSubmit(result.data);
  };

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>请检查配置</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="config-name" className="flex items-center gap-2">
          <PencilLine className="h-4 w-4" />
          配置名称
        </Label>
        <Input
          id="config-name"
          placeholder="例如：OpenAI 主账号"
          value={draft.name}
          disabled={busy}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, name: event.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="config-base-url" className="flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          Base URL
        </Label>
        <Input
          id="config-base-url"
          placeholder="https://api.openai.com/v1"
          value={draft.baseUrl}
          disabled={busy}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, baseUrl: event.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="config-api-key" className="flex items-center gap-2">
          <Key className="h-4 w-4" />
          API Key
        </Label>
        <Input
          id="config-api-key"
          type="password"
          placeholder="sk-..."
          value={draft.apiKey}
          disabled={busy}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, apiKey: event.target.value })}
        />
        <p className="text-sm text-[color:var(--report-text-subtle)]">仅保存在当前浏览器本地，不会发送到本项目服务端。</p>
      </div>

      {/* 按钮区域 */}
      <div className="space-y-3 pt-1">
        <Button
          type="button"
          className="w-full transition-all duration-200 active:scale-[0.98]"
          disabled={busy}
          onClick={handleSubmit}
        >
          <Save className="mr-2 h-4 w-4" />
          {submitLabel}
        </Button>

        {/* 删除按钮 - 红色样式，位于保存按钮下方 */}
        {showDelete && onDelete && (
          <Button
            type="button"
            variant="outline"
            className={cn(
              'w-full transition-all duration-200 active:scale-[0.98]',
              // 红色主题 - 局部定义，不修改全局配置
              'border-destructive/60 bg-transparent text-destructive/80',
              'hover:bg-destructive hover:text-destructive-foreground hover:border-destructive',
              'focus-visible:ring-destructive/30',
            )}
            disabled={busy}
            onClick={onDelete}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            删除此配置
          </Button>
        )}
      </div>
    </div>
  );
}
