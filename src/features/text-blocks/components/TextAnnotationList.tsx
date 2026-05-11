'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { TextAnnotation, TextBlockAttachment } from '@/types/report';
import ContentSourceEditor from './ContentSourceEditor';

type TextAnnotationListProps = {
  annotations: TextAnnotation[];
  blockTitle: string;
  blockId: string;
  enableAnnotations: boolean;
  enableFileUpload: boolean;
  onAddAnnotation: () => void;
  onRemoveAnnotation: (annotationId: string) => void;
  onTextInput: (annotationId: string, nextValue: string) => void;
  onFileChange: (annotationId: string, nextFile: TextBlockAttachment | null) => void;
  onAlert: (message: string) => void;
  canApplyFile: (annotationId: string, nextFile: TextBlockAttachment) => boolean;
};

export default function TextAnnotationList({
  annotations,
  blockTitle,
  blockId,
  enableAnnotations,
  enableFileUpload,
  onAddAnnotation,
  onRemoveAnnotation,
  onTextInput,
  onFileChange,
  onAlert,
  canApplyFile,
}: TextAnnotationListProps) {
  if (!enableAnnotations) {
    return null;
  }

  return (
    <div className="space-y-2">
      {/* 添加批注按钮 - 与删除按钮样式一致 */}
      <button
        type="button"
        onClick={onAddAnnotation}
        aria-label="添加批注"
        className="inline-flex items-center gap-1 rounded-lg bg-muted/50 px-2 py-1 text-xs leading-tight text-muted-foreground transition-colors hover:bg-muted"
      >
        <Plus className="h-3.5 w-3.5" />
        添加批注
      </button>

      {/* 批注块 - 左间距加倍 */}
      {annotations.map((annotation) => (
        <div key={annotation.id} className="flex items-center gap-2 pl-8 animate-slide-down">
          {/* 输入模块：宽度限制为三分之二 */}
          <div className="w-2/3">
            <ContentSourceEditor
              titleForFileName={`${blockTitle}-批注`}
              placeholder="在此处补充说明"
              content={annotation.content}
              inputId={`annotation-file-${blockId}-${annotation.id}`}
              enableFileUpload={enableFileUpload}
              compact={true}
              onTextInput={(nextValue) => onTextInput(annotation.id, nextValue)}
              onFileChange={(nextFile) => onFileChange(annotation.id, nextFile)}
              onAlert={onAlert}
              canApplyFile={(nextFile) => canApplyFile(annotation.id, nextFile)}
            />
          </div>
          {/* 删除按钮：与上传按钮样式一致 */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-lg bg-muted/50 hover:bg-muted"
            onClick={() => onRemoveAnnotation(annotation.id)}
            aria-label="移除批注"
          >
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      ))}
    </div>
  );
}
