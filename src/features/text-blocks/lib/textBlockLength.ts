import {
  getRenderedTextBlockLength,
  getTextBlockPlainTextLength,
  MAX_BLOCK_CONTENT_LENGTH,
} from '@/lib/textBlocks';
import type { TextBlock } from '@/types/report';

export function isWithinPlainTextLimit(textBlocks: TextBlock[]) {
  return getTextBlockPlainTextLength({ textBlocks }) <= MAX_BLOCK_CONTENT_LENGTH;
}

export function isWithinRenderedTextLimit(textBlocks: TextBlock[]) {
  return getRenderedTextBlockLength({ textBlocks }) <= MAX_BLOCK_CONTENT_LENGTH;
}

export function getNextRawLength(
  textBlocks: TextBlock[],
  currentTextLength: number,
  nextTextLength: number,
) {
  return getTextBlockPlainTextLength({ textBlocks }) - currentTextLength + nextTextLength;
}

export function shouldConfirmOverflow(
  textBlocks: TextBlock[],
  nextRawLength: number,
  hasConfirmedOverflow: boolean,
) {
  const currentRawLength = getTextBlockPlainTextLength({ textBlocks });
  return currentRawLength <= MAX_BLOCK_CONTENT_LENGTH && nextRawLength > MAX_BLOCK_CONTENT_LENGTH && !hasConfirmedOverflow;
}
