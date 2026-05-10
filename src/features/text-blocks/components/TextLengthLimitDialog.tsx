'use client';

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
import { MAX_BLOCK_CONTENT_LENGTH } from '@/lib/textBlocks';

type TextLengthLimitDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export default function TextLengthLimitDialog({
  open,
  onOpenChange,
  onConfirm,
}: TextLengthLimitDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>文本长度已超过 {MAX_BLOCK_CONTENT_LENGTH} 字符</AlertDialogTitle>
          <AlertDialogDescription>
            本次输入会使原始块内容总和首次超过上限。点击“继续输入”后，系统会再按渲染后的最终字符串长度校验；若仍超限，本次输入不会生效。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>继续输入</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
