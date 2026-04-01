'use client';

import { useState } from 'react';
import { showError } from '@/lib/alert';
import { MAX_BLOCK_CONTENT_LENGTH } from '@/lib/textBlocks';
import type { TextBlock, TextBlockAttachment } from '@/types/report';
import {
  buildNextBlocks,
  createAnnotation,
  createTextBlock,
  findCurrentContent,
  type PendingTextChange,
  toTextContent,
  updateBlock,
} from '@/features/text-blocks/lib/textBlockMutations';
import {
  getNextRawLength,
  isWithinPlainTextLimit,
  isWithinRenderedTextLimit,
  shouldConfirmOverflow,
} from '@/lib/textBlocks';

type UseTextBlocksEditorOptions = {
  textBlocks: TextBlock[];
  onTextBlocksChange: (value: TextBlock[]) => void;
};

export function useTextBlocksEditor({ textBlocks, onTextBlocksChange }: UseTextBlocksEditorOptions) {
  const [pendingTextChange, setPendingTextChange] = useState<PendingTextChange | null>(null);
  const [hasConfirmedOverflow, setHasConfirmedOverflow] = useState(false);

  const alertUser = (message: string) => {
    showError(message);
  };

  const applyTextBlocks = (nextBlocks: TextBlock[]) => {
    onTextBlocksChange(nextBlocks);
  };

  const dismissPendingTextChange = () => {
    setPendingTextChange(null);
  };

  const applyContentChange = (blockId: string, nextText: string, annotationId?: string) => {
    const nextBlocks = buildNextBlocks(textBlocks, blockId, toTextContent(nextText), annotationId);
    applyTextBlocks(nextBlocks);
    return nextBlocks;
  };

  const applySourceChange = (blockId: string, nextFile: TextBlockAttachment | null, annotationId?: string) => {
    const nextBlocks = buildNextBlocks(
      textBlocks,
      blockId,
      nextFile ? { kind: 'file', file: nextFile } : null,
      annotationId,
    );

    applyTextBlocks(nextBlocks);
    return nextBlocks;
  };

  const changeBlockTitle = (blockId: string, title: string) => {
    applyTextBlocks(
      updateBlock(textBlocks, blockId, (current: TextBlock) => ({
        ...current,
        title,
      })),
    );
  };

  const handleTextInput = (blockId: string, nextText: string, annotationId?: string) => {
    const currentContent = findCurrentContent(textBlocks, blockId, annotationId);
    const currentTextLength = currentContent?.kind === 'text' ? currentContent.text.length : 0;
    const nextRawLength = getNextRawLength(textBlocks, currentTextLength, nextText.length);

    if (shouldConfirmOverflow(textBlocks, nextRawLength, hasConfirmedOverflow)) {
      setPendingTextChange({
        blockId,
        annotationId,
        nextText,
      });
      return;
    }

    const nextBlocks = applyContentChange(blockId, nextText, annotationId);
    if (nextRawLength <= MAX_BLOCK_CONTENT_LENGTH) {
      setHasConfirmedOverflow(false);
    }
  };

  const canApplyFileChange = (blockId: string, nextFile: TextBlockAttachment, annotationId?: string) => {
    const nextBlocks = buildNextBlocks(textBlocks, blockId, { kind: 'file', file: nextFile }, annotationId);

    if (!isWithinPlainTextLimit(nextBlocks)) {
      alertUser(`当前总文本长度不能超过 ${MAX_BLOCK_CONTENT_LENGTH} 字符，请删减后再上传。`);
      return false;
    }

    if (!isWithinRenderedTextLimit(nextBlocks)) {
      alertUser(`渲染后的文本长度超过 ${MAX_BLOCK_CONTENT_LENGTH} 字符，请删减后再上传。`);
      return false;
    }

    return true;
  };

  const handleFileChange = (blockId: string, nextFile: TextBlockAttachment | null, annotationId?: string) => {
    const nextBlocks = applySourceChange(blockId, nextFile, annotationId);
    if (isWithinPlainTextLimit(nextBlocks)) {
      setHasConfirmedOverflow(false);
    }
  };

  const addBlock = () => {
    applyTextBlocks([...textBlocks, createTextBlock()]);
  };

  const removeBlock = (blockId: string) => {
    applyTextBlocks(textBlocks.filter((block: TextBlock) => block.id !== blockId));
  };

  const addAnnotation = (blockId: string) => {
    applyTextBlocks(
      updateBlock(textBlocks, blockId, (block: TextBlock) => ({
        ...block,
        annotations: [...block.annotations, createAnnotation()],
      })),
    );
  };

  const removeAnnotation = (blockId: string, annotationId: string) => {
    applyTextBlocks(
      updateBlock(textBlocks, blockId, (block: TextBlock) => ({
        ...block,
        annotations: block.annotations.filter((annotation) => annotation.id !== annotationId),
      })),
    );
  };

  const confirmPendingTextChange = () => {
    if (!pendingTextChange) {
      return;
    }

    const nextBlocks = buildNextBlocks(
      textBlocks,
      pendingTextChange.blockId,
      toTextContent(pendingTextChange.nextText),
      pendingTextChange.annotationId,
    );

    if (!isWithinRenderedTextLimit(nextBlocks)) {
      alertUser(`渲染后的文本长度超过 ${MAX_BLOCK_CONTENT_LENGTH} 字符，本次输入未生效。`);
      dismissPendingTextChange();
      return;
    }

    applyTextBlocks(nextBlocks);
    setHasConfirmedOverflow(!isWithinPlainTextLimit(nextBlocks));
    dismissPendingTextChange();
  };

  return {
    pendingTextChange,
    alertUser,
    addBlock,
    removeBlock,
    changeBlockTitle,
    addAnnotation,
    removeAnnotation,
    handleTextInput,
    handleFileChange,
    canApplyFileChange,
    confirmPendingTextChange,
    dismissPendingTextChange,
  };
}
