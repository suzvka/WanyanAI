'use client';

import { FileText, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  onTextBlocksChange: (value: TextBlock[]) => void;
};

export default function TextBlocksEditor({
  title = '文本输入',
  description = '支持多个文本块及块内批注。上传 txt 文件后会保留带 UUID 的文件名引用，并将正文转为字符串进入分析链路。',
  textBlocks,
  enableFileUpload = true,
  enableAnnotations = true,
  onTextBlocksChange,
}: TextBlocksEditorProps) {
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
  });

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">共 {textBlocks.length} 个文本块</div>
            <Button type="button" variant="outline" size="sm" onClick={addBlock}>
              <Plus className="mr-1 h-4 w-4" />
              添加文本块
            </Button>
          </div>

          <section className="space-y-4">
            {textBlocks.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm text-muted-foreground">
                暂无文本块，点击上方按钮添加
              </div>
            ) : (
              textBlocks.map((block: TextBlock) => (
                <TextBlockCard
                  key={block.id}
                  block={block}
                  enableFileUpload={enableFileUpload}
                  enableAnnotations={enableAnnotations}
                  onTitleChange={(value: string) => changeBlockTitle(block.id, value)}
                  onBlockTypeChange={(value) => changeBlockType(block.id, value)}
                  onRemoveBlock={() => removeBlock(block.id)}
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
              ))
            )}
          </section>
        </CardContent>
      </Card>

      <TextLengthLimitDialog
        open={pendingTextChange !== null}
        onOpenChange={(open: boolean) => !open && dismissPendingTextChange()}
        onConfirm={confirmPendingTextChange}
      />
    </>
  );
}
