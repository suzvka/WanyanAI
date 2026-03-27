'use client';

import type { ChangeEvent, DragEvent, FormEvent } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MAX_BLOCK_CONTENT_LENGTH } from '@/lib/textBlocks';
import type { ContentSource, TextBlockAttachment } from '@/types/report';

type ContentSourceEditorProps = {
  titleForFileName: string;
  placeholder: string;
  content: ContentSource | null;
  inputId: string;
  enableFileUpload: boolean;
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
  onTextInput,
  onFileChange,
  onAlert,
  canApplyFile,
}: ContentSourceEditorProps) {
  const file = content?.kind === 'file' ? content.file : null;
  const textValue = content?.kind === 'text' ? content.text : '';

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

  return (
    <div
      className="space-y-3 rounded-lg border border-dashed border-slate-200 p-4"
      onDragOver={(event: DragEvent<HTMLDivElement>) => enableFileUpload && event.preventDefault()}
      onDrop={handleDrop}
    >
      {file ? (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="font-medium text-slate-900">{file.originalName}</div>
              <div className="text-sm text-slate-500">
                引用名：{file.storedName} · {getFileDisplaySize(file.size)}
              </div>
            </div>
            <Button variant="ghost" size="sm" type="button" onClick={() => onFileChange(null)}>
              <X className="mr-1 h-4 w-4" />
              移除文件
            </Button>
          </div>
          {enableFileUpload && (
            <input
              id={inputId}
              type="file"
              accept=".txt,text/plain"
              className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-700"
              onChange={handleFileInputChange}
            />
          )}
        </div>
      ) : (
        <>
          <Textarea
            placeholder={placeholder}
            className="min-h-[180px] leading-relaxed"
            value={textValue}
            onInput={(event: FormEvent<HTMLTextAreaElement>) => onTextInput(event.currentTarget.value)}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
            <span>
              {enableFileUpload
                ? '可直接输入文本，或拖放 / 选择单个 txt 文件。选择文件后会替换当前文本。'
                : '当前配置仅支持纯文本输入。'}
            </span>
            <span>
              {textValue.length} / {MAX_BLOCK_CONTENT_LENGTH}
            </span>
          </div>
          {enableFileUpload && (
            <input
              id={inputId}
              type="file"
              accept=".txt,text/plain"
              className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-700"
              onChange={handleFileInputChange}
            />
          )}
        </>
      )}
    </div>
  );
}
