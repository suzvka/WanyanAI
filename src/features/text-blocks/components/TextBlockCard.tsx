'use client';

import type { ChangeEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { TextBlock, TextBlockAttachment } from '@/types/report';
import ContentSourceEditor from './ContentSourceEditor';
import TextAnnotationList from './TextAnnotationList';

type TextBlockCardProps = {
  block: TextBlock;
  /** 文本块在容器中的索引（用于显示序号） */
  index: number;
  enableFileUpload: boolean;
  enableAnnotations: boolean;
  onTitleChange: (value: string) => void;
  onRemoveBlock: () => void;
  onBlockTextInput: (value: string) => void;
  onBlockFileChange: (nextFile: TextBlockAttachment | null) => void;
  onAddAnnotation: () => void;
  onRemoveAnnotation: (annotationId: string) => void;
  onAnnotationTextInput: (annotationId: string, value: string) => void;
  onAnnotationFileChange: (annotationId: string, nextFile: TextBlockAttachment | null) => void;
  onAlert: (message: string) => void;
  canApplyBlockFile: (nextFile: TextBlockAttachment) => boolean;
  canApplyAnnotationFile: (annotationId: string, nextFile: TextBlockAttachment) => boolean;
};

export default function TextBlockCard({
  block,
  index,
  enableFileUpload,
  enableAnnotations,
  onTitleChange,
  onRemoveBlock,
  onBlockTextInput,
  onBlockFileChange,
  onAddAnnotation,
  onRemoveAnnotation,
  onAnnotationTextInput,
  onAnnotationFileChange,
  onAlert,
  canApplyBlockFile,
  canApplyAnnotationFile,
}: TextBlockCardProps) {
  const blockTitle = block.title.trim() || `文本${index + 1}`;

  return (
    <div className="space-y-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Input
            id={`title-${block.id}`}
            value={block.title}
            placeholder={`段落标题 #${index + 1}`}
            className="h-9 w-auto min-w-[120px] max-w-[240px] px-3 text-base font-semibold"
            onChange={(event: ChangeEvent<HTMLInputElement>) => onTitleChange(event.target.value)}
          />
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemoveBlock}
            aria-label="删除文本块"
            className="h-8 w-8 rounded-lg bg-[color:var(--report-danger-soft)] hover:bg-[color:var(--report-danger-soft)]"
          >
            <Trash2 className="h-4 w-4 text-[color:var(--report-danger)]" />
          </Button>
        </div>
      </div>

      <ContentSourceEditor
        titleForFileName={blockTitle}
        placeholder="在此处粘贴文本或拖放文件"
        content={block.content}
        inputId={`file-${block.id}`}
        enableFileUpload={enableFileUpload}
        onTextInput={onBlockTextInput}
        onFileChange={onBlockFileChange}
        onAlert={onAlert}
        canApplyFile={canApplyBlockFile}
      />

      <TextAnnotationList
        annotations={block.annotations}
        blockTitle={blockTitle}
        blockId={block.id}
        enableAnnotations={enableAnnotations}
        enableFileUpload={enableFileUpload}
        onAddAnnotation={onAddAnnotation}
        onRemoveAnnotation={onRemoveAnnotation}
        onTextInput={onAnnotationTextInput}
        onFileChange={onAnnotationFileChange}
        onAlert={onAlert}
        canApplyFile={canApplyAnnotationFile}
      />
    </div>
  );
}
