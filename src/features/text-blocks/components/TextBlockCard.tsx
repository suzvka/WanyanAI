'use client';

import type { ChangeEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getTextBlockTypeLabel } from '@/lib/textBlocks';
import type { TextBlock, TextBlockAttachment, TextBlockType } from '@/types/report';
import { textBlockTypeOptions } from '@/features/text-blocks/lib/textBlockMutations';
import ContentSourceEditor from './ContentSourceEditor';
import TextAnnotationList from './TextAnnotationList';

type TextBlockCardProps = {
  block: TextBlock;
  enableFileUpload: boolean;
  enableAnnotations: boolean;
  onTitleChange: (value: string) => void;
  onBlockTypeChange: (value: TextBlockType) => void;
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
  enableFileUpload,
  enableAnnotations,
  onTitleChange,
  onBlockTypeChange,
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
  const blockTitle = block.title.trim() || `文本${block.number}`;

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Input
            id={`title-${block.id}`}
            value={block.title}
            placeholder={`文本块 ${block.number}`}
            className="h-9 w-auto min-w-[120px] max-w-[240px] border-0 bg-transparent px-0 text-base font-semibold text-slate-900 shadow-none focus-visible:ring-0"
            onChange={(event: ChangeEvent<HTMLInputElement>) => onTitleChange(event.target.value)}
          />
          <Select value={block.blockType} onValueChange={(value: string) => onBlockTypeChange(value as TextBlockType)}>
            <SelectTrigger className="h-8 w-auto min-w-[100px] text-sm">
              <SelectValue placeholder="类型" />
            </SelectTrigger>
            <SelectContent>
              {textBlockTypeOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {getTextBlockTypeLabel(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon" onClick={onRemoveBlock} aria-label="删除文本块">
            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-red-500" />
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
