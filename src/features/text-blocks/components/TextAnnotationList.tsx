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
    <div className="space-y-2 pt-2">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-medium text-muted-foreground">批注</div>
        <Button type="button" variant="ghost" size="sm" onClick={onAddAnnotation} aria-label="添加批注">
          <Plus className="h-4 w-4" />
          批注
        </Button>
      </div>

      {annotations.map((annotation, index) => (
        <div key={annotation.id} className="space-y-2 rounded-lg border border-slate-200 bg-muted/30 p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-muted-foreground">批注 {index + 1}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onRemoveAnnotation(annotation.id)}
              aria-label="移除批注"
            >
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-red-500" />
            </Button>
          </div>
          <ContentSourceEditor
            titleForFileName={`${blockTitle}-批注${index + 1}`}
            placeholder="补充背景、评价或限制信息"
            content={annotation.content}
            inputId={`annotation-file-${blockId}-${annotation.id}`}
            enableFileUpload={enableFileUpload}
            onTextInput={(nextValue) => onTextInput(annotation.id, nextValue)}
            onFileChange={(nextFile) => onFileChange(annotation.id, nextFile)}
            onAlert={onAlert}
            canApplyFile={(nextFile) => canApplyFile(annotation.id, nextFile)}
          />
        </div>
      ))}
    </div>
  );
}
