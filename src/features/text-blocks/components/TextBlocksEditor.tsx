'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import CollapsiblePanel from '@/components/ui/collapsible-panel';
import { cn } from '@/lib/utils';
import type { TextBlock, TextBlockAttachment } from '@/types/report';
import TextBlockCard from './TextBlockCard';
import TextLengthLimitDialog from './TextLengthLimitDialog';
import { useTextBlocksEditor } from '@/features/text-blocks/hooks/useTextBlocksEditor';

type TextBlocksEditorProps = {
  title?: string;
  description?: string;
  textBlocks: TextBlock[];
  enableFileUpload?: boolean;
  enableAnnotations?: boolean;
  fixedBlockType?: string;
  defaultExpanded?: boolean;
  onTextBlocksChange: (value: TextBlock[]) => void;
};

export default function TextBlocksEditor({
  title = '文本输入',
  description,
  textBlocks,
  enableFileUpload = true,
  enableAnnotations = true,
  fixedBlockType,
  defaultExpanded = true,
  onTextBlocksChange,
}: TextBlocksEditorProps) {
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const {
    pendingTextChange,
    alertUser,
    addBlock,
    removeBlock,
    changeBlockTitle,
    changeBlockType,
    addAnnotation,
    removeAnnotation,
    handleTextInput,
    handleFileChange,
    canApplyFileChange,
    confirmPendingTextChange,
    dismissPendingTextChange,
  } = useTextBlocksEditor({
    textBlocks,
    onTextBlocksChange,
    fixedBlockType,
  });

  const handleConfirmDelete = () => {
    if (deleteTargetId) {
      removeBlock(deleteTargetId);
      setDeleteTargetId(null);
    }
  };

  return (
    <>
      <CollapsiblePanel
        title={title}
        subtitle={description}
        defaultExpanded={defaultExpanded}
      >
        <div className="space-y-0">
          {textBlocks.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              暂无文本块，点击下方按钮添加
            </div>
          ) : (
            textBlocks.map((block: TextBlock, index: number) => (
              <div key={block.id} className="animate-slide-down">
                <TextBlockCard
                  block={block}
                  enableFileUpload={enableFileUpload}
                  enableAnnotations={enableAnnotations}
                  fixedBlockType={fixedBlockType}
                  onTitleChange={(value: string) => changeBlockTitle(block.id, value)}
                  onBlockTypeChange={(value) => changeBlockType(block.id, value)}
                  onRemoveBlock={() => setDeleteTargetId(block.id)}
                  onBlockTextInput={(value: string) => handleTextInput(block.id, value)}
                  onBlockFileChange={(nextFile: TextBlockAttachment | null) => handleFileChange(block.id, nextFile)}
                  onAddAnnotation={() => addAnnotation(block.id)}
                  onRemoveAnnotation={(annotationId: string) => removeAnnotation(block.id, annotationId)}
                  onAnnotationTextInput={(annotationId: string, value: string) => handleTextInput(block.id, value, annotationId)}
                  onAnnotationFileChange={(annotationId: string, nextFile: TextBlockAttachment | null) =>
                    handleFileChange(block.id, nextFile, annotationId)
                  }
                  onAlert={alertUser}
                  canApplyBlockFile={(nextFile: TextBlockAttachment) => canApplyFileChange(block.id, nextFile)}
                  canApplyAnnotationFile={(annotationId: string, nextFile: TextBlockAttachment) =>
                    canApplyFileChange(block.id, nextFile, annotationId)
                  }
                />
                {/* 文本块分隔线 + 新增按钮 */}
                {index < textBlocks.length - 1 ? (
                  <div className="border-t-3 border-border/100 my-1" />
                ) : (
                  <div className="border-t-3 border-border/100 py-3 flex justify-center">
                    <button
                      type="button"
                      onClick={addBlock}
                      className={cn(
                        'flex items-center justify-center gap-2 rounded-lg',
                        'bg-muted/50 transition-all duration-200',
                        'h-10 px-6',
                        'text-muted-foreground hover:bg-muted hover:text-primary',
                        'select-none',
                      )}
                      title="添加文本块"
                    >
                      <Plus className="h-5 w-5" />
                      <span className="text-sm">添加文本块</span>
                    </button>
                  </div>
                )}
              </div>
            ))
          )}

          {/* 当没有文本块时，显示新增按钮 */}
          {textBlocks.length === 0 && (
            <div className="flex justify-center py-8">
              <button
                type="button"
                onClick={addBlock}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-lg',
                  'bg-muted/50 transition-all duration-200',
                  'h-10 px-6',
                  'text-muted-foreground hover:bg-muted hover:text-primary',
                  'select-none',
                )}
                title="添加文本块"
              >
                <Plus className="h-5 w-5" />
                <span className="text-sm">添加文本块</span>
              </button>
            </div>
          )}
        </div>
      </CollapsiblePanel>

      {/* 文本长度限制对话框 */}
      <TextLengthLimitDialog
        open={pendingTextChange !== null}
        onOpenChange={(open: boolean) => !open && dismissPendingTextChange()}
        onConfirm={confirmPendingTextChange}
      />

      {/* 删除确认对话框 */}
      <AlertDialog
        open={deleteTargetId !== null}
        onOpenChange={(open: boolean) => !open && setDeleteTargetId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除该文本块？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后，该文本块中的所有内容将被清除，此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmDelete}
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
