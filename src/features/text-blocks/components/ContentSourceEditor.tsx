'use client';

import type { ChangeEvent, DragEvent, FormEvent } from 'react';
import { FileText, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MAX_BLOCK_CONTENT_LENGTH } from '@/lib/textBlocks';
import { cn } from '@/lib/utils';
import type { ContentSource, TextBlockAttachment } from '@/types/report';

type ContentSourceEditorProps = {
  titleForFileName: string;
  placeholder: string;
  content: ContentSource | null;
  inputId: string;
  enableFileUpload: boolean;
  /** 紧凑模式，用于批注等附属内容，视觉强度更弱 */
  compact?: boolean;
  onTextInput: (nextValue: string) => void;
  onFileChange: (nextFile: TextBlockAttachment | null) => void;
  onAlert: (message: string) => void;
  canApplyFile: (nextFile: TextBlockAttachment) => boolean;
};

function sanitizeFileStem(value: string, fallback: string): string {
  const sanitized = value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ').replace(/\s+/g, ' ').trim();
  return sanitized || fallback;
}

function appendUuidToFileName(fileName: string, uuid: string): string {
  const extensionIndex = fileName.lastIndexOf('.');
  if (extensionIndex <= 0) {
    return `${fileName}-${uuid}`;
  }

  const baseName = fileName.slice(0, extensionIndex);
  const extension = fileName.slice(extensionIndex);
  return `${baseName}-${uuid}${extension}`;
}

function isPlainTextFile(file: File) {
  const mimeType = file.type.trim().toLowerCase();
  return (mimeType === '' || mimeType.startsWith('text/plain')) && file.name.toLowerCase().endsWith('.txt');
}

async function buildStoredFile(file: File, title: string): Promise<TextBlockAttachment> {
  const id = crypto.randomUUID();
  const originalName = file.name.trim() || `${sanitizeFileStem(title, '文本')}.txt`;
  const storedName = appendUuidToFileName(originalName, id);
  const content = await file.text();

  return {
    id,
    originalName,
    storedName,
    mimeType: file.type || 'text/plain',
    size: file.size,
    lastModified: file.lastModified || Date.now(),
    source: 'upload',
    content,
  };
}

function getFileDisplaySize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ContentSourceEditor({
  titleForFileName,
  placeholder,
  content,
  inputId,
  enableFileUpload,
  compact = false,
  onTextInput,
  onFileChange,
  onAlert,
  canApplyFile,
}: ContentSourceEditorProps) {
  const file = content?.kind === 'file' ? content.file : null;
  const textValue = content?.kind === 'text' ? content.text : '';
  const hasTextContent = textValue.trim().length > 0;

  const applyFile = async (fileToUpload: File) => {
    if (!isPlainTextFile(fileToUpload)) {
      onAlert('当前仅支持上传 txt/plain text 文件。');
      return;
    }

    const nextFile = await buildStoredFile(fileToUpload, titleForFileName);
    if (nextFile.content.length > MAX_BLOCK_CONTENT_LENGTH) {
      onAlert(`单个文件不能超过 ${MAX_BLOCK_CONTENT_LENGTH} 字符。`);
      return;
    }

    if (!canApplyFile(nextFile)) {
      return;
    }

    onFileChange(nextFile);
  };

  const handleFileInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0];
    if (nextFile) {
      await applyFile(nextFile);
    }

    event.target.value = '';
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!enableFileUpload) {
      return;
    }

    const nextFile = event.dataTransfer.files?.[0];
    if (nextFile) {
      await applyFile(nextFile);
    }
  };

  const handleRemoveFile = () => {
    onFileChange(null);
  };

  // 文件模式：显示文件名 + 移除按钮
  if (file) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 rounded-lg bg-muted/30 p-2',
          !compact && 'border',
        )}
        onDragOver={(event: DragEvent<HTMLDivElement>) => enableFileUpload && event.preventDefault()}
        onDrop={handleDrop}
      >
        <FileText className={cn('shrink-0 text-muted-foreground', compact ? 'h-4 w-4' : 'h-5 w-5')} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm">{file.originalName}</div>
          {!compact && (
            <div className="text-xs text-muted-foreground">
              {getFileDisplaySize(file.size)}
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          type="button"
          onClick={handleRemoveFile}
          className={cn(
            'shrink-0',
            compact
              ? 'h-6 w-6 text-muted-foreground hover:text-destructive'
              : 'h-8 w-8 rounded-lg bg-destructive/10 hover:bg-destructive/20',
          )}
        >
          <X className={compact ? 'h-3 w-3' : 'h-4 w-4 text-destructive'} />
        </Button>
      </div>
    );
  }

  // 文本模式：显示输入框 + 选择文件按钮（如果文本为空且启用文件上传）
  return (
    <div
      className="flex items-center gap-2"
      onDragOver={(event: DragEvent<HTMLDivElement>) => enableFileUpload && event.preventDefault()}
      onDrop={handleDrop}
    >
      {/* 文本输入框 */}
      <Textarea
        placeholder={placeholder}
        className={cn(
          'flex-1 resize-none leading-relaxed overflow-y-auto',
          compact
            ? 'min-h-[60px] max-h-[200px] text-sm'
            : 'min-h-[120px] max-h-[300px]',
        )}
        value={textValue}
        onInput={(event: FormEvent<HTMLTextAreaElement>) => onTextInput(event.currentTarget.value)}
      />

      {/* 选择文件按钮 - 与删除按钮样式一致 */}
      {enableFileUpload && !hasTextContent && (
        <label
          htmlFor={inputId}
          className={cn(
            'flex shrink-0 cursor-pointer items-center justify-center',
            'rounded-lg bg-muted/50 transition-colors hover:bg-muted',
            compact ? 'h-8 w-8' : 'h-8 w-8',
          )}
        >
          <Upload className={cn('text-muted-foreground', compact ? 'h-4 w-4' : 'h-4 w-4')} />
          <input
            id={inputId}
            type="file"
            accept=".txt,text/plain"
            className="hidden"
            onChange={handleFileInputChange}
          />
        </label>
      )}
    </div>
  );
}
