'use client';

import { ChangeEvent, DragEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { FileText, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
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
import {
  getRenderedTextBlockLength,
  getTextBlockPlainTextLength,
  getTextBlockTypeLabel,
  MAX_BLOCK_CONTENT_LENGTH,
} from '@/lib/textBlocks';
import { TextBlock, TextBlockAttachment, TextBlockContentUnit, TextBlockSupplement, TextBlockType } from '@/types/report';

interface TextInputPanelProps {
  title?: string;
  description?: string;
  textBlocks: TextBlock[];
  globalSupplementBlocks: TextBlock[];
  enableFileUpload?: boolean;
  enableGlobalSupplementBlocks?: boolean;
  enableLocalSupplements?: boolean;
  onTextBlocksChange: (value: TextBlock[]) => void;
  onGlobalSupplementBlocksChange: (value: TextBlock[]) => void;
}

type BlockCollectionKey = 'textBlocks' | 'globalSupplementBlocks';

type PendingTextChange = {
  collection: BlockCollectionKey;
  blockId: string;
  supplementId?: string;
  nextDraftText: string;
};

const textBlockTypeOptions: TextBlockType[] = ['actual_text', 'reference_material', 'reference_review'];

function createTextBlock(number: number): TextBlock {
  return {
    id: crypto.randomUUID(),
    number,
    blockType: 'actual_text',
    title: `文本${number}`,
    draftText: '',
    file: null,
    localSupplements: [],
  };
}

function createSupplement(): TextBlockSupplement {
  return {
    id: crypto.randomUUID(),
    draftText: '',
    file: null,
  };
}

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

function getNextBlockNumber(textBlocks: TextBlock[], globalSupplementBlocks: TextBlock[]) {
  return [...textBlocks, ...globalSupplementBlocks].reduce((max, block) => Math.max(max, block.number), 0) + 1;
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

type ContentUnitEditorProps = {
  titleForFileName: string;
  placeholder: string;
  unit: TextBlockContentUnit;
  inputId: string;
  enableFileUpload: boolean;
  onTextInput: (nextValue: string) => void;
  onFileChange: (nextFile: TextBlockAttachment | null) => void;
  onAlert: (message: string) => void;
  canApplyFile: (nextFile: TextBlockAttachment) => boolean;
};

function ContentUnitEditor({
  titleForFileName,
  placeholder,
  unit,
  inputId,
  enableFileUpload,
  onTextInput,
  onFileChange,
  onAlert,
  canApplyFile,
}: ContentUnitEditorProps) {
  const applyFile = async (file: File) => {
    if (!isPlainTextFile(file)) {
      onAlert('当前仅支持上传 txt/plain text 文件。');
      return;
    }

    const nextFile = await buildStoredFile(file, titleForFileName);
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
      {unit.file ? (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="font-medium text-slate-900">{unit.file.originalName}</div>
              <div className="text-sm text-slate-500">
                引用名：{unit.file.storedName} · {getFileDisplaySize(unit.file.size)}
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
            value={unit.draftText}
            onInput={(event: FormEvent<HTMLTextAreaElement>) => onTextInput(event.currentTarget.value)}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
            <span>
              {enableFileUpload
                ? '可直接输入文本，或拖放 / 选择单个 txt 文件。选择文件后会替换当前文本。'
                : '当前配置仅支持纯文本输入。'}
            </span>
            <span>
              {unit.draftText.length} / {MAX_BLOCK_CONTENT_LENGTH}
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

export default function TextInputPanel({
  title = '文本输入',
  description = '支持多个主文本块、整体说明块以及针对单个文本块的局部说明。上传 txt 文件后会保留带 UUID 的文件名引用，并将正文转为字符串进入分析链路。',
  textBlocks,
  globalSupplementBlocks,
  enableFileUpload = true,
  enableGlobalSupplementBlocks = true,
  enableLocalSupplements = true,
  onTextBlocksChange,
  onGlobalSupplementBlocksChange,
}: TextInputPanelProps) {
  const nextBlockNumberRef = useRef(getNextBlockNumber(textBlocks, globalSupplementBlocks));
  const [pendingTextChange, setPendingTextChange] = useState<PendingTextChange | null>(null);
  const [hasConfirmedOverflow, setHasConfirmedOverflow] = useState(false);

  useEffect(() => {
    nextBlockNumberRef.current = Math.max(nextBlockNumberRef.current, getNextBlockNumber(textBlocks, globalSupplementBlocks));
  }, [textBlocks, globalSupplementBlocks]);

  useEffect(() => {
    if (getTextBlockPlainTextLength({ textBlocks, globalSupplementBlocks }) <= MAX_BLOCK_CONTENT_LENGTH) {
      setHasConfirmedOverflow(false);
    }
  }, [textBlocks, globalSupplementBlocks]);

  const getBlocks = (collection: BlockCollectionKey) =>
    collection === 'textBlocks' ? textBlocks : globalSupplementBlocks;

  const setBlocks = (collection: BlockCollectionKey, nextBlocks: TextBlock[]) => {
    if (collection === 'textBlocks') {
      onTextBlocksChange(nextBlocks);
      return;
    }

    onGlobalSupplementBlocksChange(nextBlocks);
  };

  const alertUser = (message: string) => {
    window.alert(message);
  };

  const allocateBlockNumber = () => {
    const nextNumber = Math.max(nextBlockNumberRef.current, getNextBlockNumber(textBlocks, globalSupplementBlocks));
    nextBlockNumberRef.current = nextNumber + 1;
    return nextNumber;
  };

  const updateBlock = (collection: BlockCollectionKey, blockId: string, updater: (block: TextBlock) => TextBlock) => {
    setBlocks(
      collection,
      getBlocks(collection).map((block) => (block.id === blockId ? updater(block) : block)),
    );
  };

  const buildNextInput = (
    collection: BlockCollectionKey,
    blockId: string,
    nextUnit: TextBlockContentUnit,
    supplementId?: string,
  ) => {
    const nextBlocks = getBlocks(collection).map((block) => {
      if (block.id !== blockId) {
        return block;
      }

      if (!supplementId) {
        return {
          ...block,
          draftText: nextUnit.draftText,
          file: nextUnit.file,
        };
      }

      return {
        ...block,
        localSupplements: block.localSupplements.map((supplement) =>
          supplement.id === supplementId
            ? {
                ...supplement,
                draftText: nextUnit.draftText,
                file: nextUnit.file,
              }
            : supplement,
        ),
      };
    });

    return {
      textBlocks: collection === 'textBlocks' ? nextBlocks : textBlocks,
      globalSupplementBlocks: collection === 'globalSupplementBlocks' ? nextBlocks : globalSupplementBlocks,
    };
  };

  const commitNextInput = (
    collection: BlockCollectionKey,
    nextInput: { textBlocks: TextBlock[]; globalSupplementBlocks: TextBlock[] },
  ) => {
    if (collection === 'textBlocks') {
      onTextBlocksChange(nextInput.textBlocks);
      return;
    }

    onGlobalSupplementBlocksChange(nextInput.globalSupplementBlocks);
  };

  const handleTextInput = (
    collection: BlockCollectionKey,
    blockId: string,
    nextDraftText: string,
    supplementId?: string,
  ) => {
    const currentRawLength = getTextBlockPlainTextLength({ textBlocks, globalSupplementBlocks });
    const currentBlock = getBlocks(collection).find((block) => block.id === blockId);
    const currentUnit = supplementId
      ? currentBlock?.localSupplements.find((supplement) => supplement.id === supplementId)
      : currentBlock;

    if (!currentUnit) {
      return;
    }

    const nextRawLength = currentRawLength - currentUnit.draftText.length + nextDraftText.length;
    if (currentRawLength <= MAX_BLOCK_CONTENT_LENGTH && nextRawLength > MAX_BLOCK_CONTENT_LENGTH && !hasConfirmedOverflow) {
      setPendingTextChange({
        collection,
        blockId,
        supplementId,
        nextDraftText,
      });
      return;
    }

    const nextInput = buildNextInput(
      collection,
      blockId,
      {
        draftText: nextDraftText,
        file: null,
      },
      supplementId,
    );

    commitNextInput(collection, nextInput);
    if (nextRawLength <= MAX_BLOCK_CONTENT_LENGTH) {
      setHasConfirmedOverflow(false);
    }
  };

  const canApplyFileChange = (
    collection: BlockCollectionKey,
    blockId: string,
    nextFile: TextBlockAttachment,
    supplementId?: string,
  ) => {
    const nextInput = buildNextInput(
      collection,
      blockId,
      {
        draftText: '',
        file: nextFile,
      },
      supplementId,
    );

    const nextRawLength = getTextBlockPlainTextLength(nextInput);
    if (nextRawLength > MAX_BLOCK_CONTENT_LENGTH) {
      alertUser(`当前总文本长度不能超过 ${MAX_BLOCK_CONTENT_LENGTH} 字符，请删减后再上传。`);
      return false;
    }

    if (getRenderedTextBlockLength(nextInput) > MAX_BLOCK_CONTENT_LENGTH) {
      alertUser(`渲染后的文本长度超过 ${MAX_BLOCK_CONTENT_LENGTH} 字符，请删减后再上传。`);
      return false;
    }

    return true;
  };

  const handleFileChange = (
    collection: BlockCollectionKey,
    blockId: string,
    nextFile: TextBlockAttachment | null,
    supplementId?: string,
  ) => {
    const nextInput = buildNextInput(
      collection,
      blockId,
      {
        draftText: '',
        file: nextFile,
      },
      supplementId,
    );

    const nextRawLength = getTextBlockPlainTextLength(nextInput);

    commitNextInput(collection, nextInput);
    if (nextRawLength <= MAX_BLOCK_CONTENT_LENGTH) {
      setHasConfirmedOverflow(false);
    }
    return true;
  };

  const addBlock = (collection: BlockCollectionKey) => {
    setBlocks(collection, [...getBlocks(collection), createTextBlock(allocateBlockNumber())]);
  };

  const removeBlock = (collection: BlockCollectionKey, blockId: string) => {
    setBlocks(
      collection,
      getBlocks(collection).filter((block) => block.id !== blockId),
    );
  };

  const addLocalSupplement = (collection: BlockCollectionKey, blockId: string) => {
    updateBlock(collection, blockId, (block) => ({
      ...block,
      localSupplements: [...block.localSupplements, createSupplement()],
    }));
  };

  const removeLocalSupplement = (collection: BlockCollectionKey, blockId: string, supplementId: string) => {
    updateBlock(collection, blockId, (block) => ({
      ...block,
      localSupplements: block.localSupplements.filter((supplement) => supplement.id !== supplementId),
    }));
  };

  const confirmPendingTextChange = () => {
    if (!pendingTextChange) {
      return;
    }

    const nextInput = buildNextInput(
      pendingTextChange.collection,
      pendingTextChange.blockId,
      {
        draftText: pendingTextChange.nextDraftText,
        file: null,
      },
      pendingTextChange.supplementId,
    );

    if (getRenderedTextBlockLength(nextInput) > MAX_BLOCK_CONTENT_LENGTH) {
      alertUser(`渲染后的文本长度超过 ${MAX_BLOCK_CONTENT_LENGTH} 字符，本次输入未生效。`);
      setPendingTextChange(null);
      return;
    }

    commitNextInput(pendingTextChange.collection, nextInput);
    setHasConfirmedOverflow(getTextBlockPlainTextLength(nextInput) > MAX_BLOCK_CONTENT_LENGTH);
    setPendingTextChange(null);
  };

  const renderBlockList = (collection: BlockCollectionKey, heading: string, description: string) => {
    const blocks = getBlocks(collection);
    const addButtonLabel = collection === 'textBlocks' ? '添加文本块' : '添加整体说明块';
    const canAddBlocks = collection === 'textBlocks' || enableGlobalSupplementBlocks;

    return (
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-base font-medium text-slate-900">{heading}</h3>
            <p className="text-sm text-slate-500">{description}</p>
          </div>
          {canAddBlocks && (
            <Button type="button" variant="outline" onClick={() => addBlock(collection)}>
              <Plus className="mr-2 h-4 w-4" />
              {addButtonLabel}
            </Button>
          )}
        </div>

        {blocks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 p-6 text-sm text-slate-500">当前没有文本块，可随时新增。</div>
        ) : (
          blocks.map((block) => {
            const blockTitle = block.title.trim() || `文本${block.number}`;

            return (
              <div key={block.id} className="space-y-4 rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-slate-900">文本块 #{block.number}</div>
                    <div className="text-sm text-slate-500">类型用于描述该块在评审中的角色，编号固定不重排。</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {enableLocalSupplements && (
                      <Button type="button" variant="outline" size="icon" onClick={() => addLocalSupplement(collection, block.id)} aria-label="添加说明">
                        <Plus className="h-4 w-4" />
                      </Button>
                    )}
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeBlock(collection, block.id)} aria-label="删除文本块">
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_200px]">
                  <div className="space-y-2">
                    <Label htmlFor={`title-${block.id}`}>标题</Label>
                    <Input
                      id={`title-${block.id}`}
                      value={block.title}
                      placeholder={`文本${block.number}`}
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        updateBlock(collection, block.id, (current) => ({
                          ...current,
                          title: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>类型</Label>
                    <Select
                      value={block.blockType}
                      onValueChange={(value: string) =>
                        updateBlock(collection, block.id, (current) => ({
                          ...current,
                          blockType: value as TextBlockType,
                        }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="选择类型" />
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
                </div>

                <div className="space-y-2">
                  <Label>正文 / 文件</Label>
                  <ContentUnitEditor
                    titleForFileName={blockTitle}
                    placeholder="在此处粘贴文本或拖放文件"
                    unit={block}
                    inputId={`file-${block.id}`}
                    enableFileUpload={enableFileUpload}
                    onTextInput={(nextValue) => handleTextInput(collection, block.id, nextValue)}
                    onFileChange={(nextFile) => handleFileChange(collection, block.id, nextFile)}
                    onAlert={alertUser}
                    canApplyFile={(nextFile) => canApplyFileChange(collection, block.id, nextFile)}
                  />
                </div>

                {(block.localSupplements.length > 0 || enableLocalSupplements) && (
                  <div className="space-y-3 rounded-lg bg-slate-50 p-4">
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-slate-900">局部说明</div>
                      <div className="text-sm text-slate-500">用于补充针对当前文本块局部内容的背景、评价或限定信息。</div>
                    </div>

                    {block.localSupplements.map((supplement, index) => (
                      <div key={supplement.id} className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-medium text-slate-900">说明 {index + 1}</div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeLocalSupplement(collection, block.id, supplement.id)}
                            aria-label="移除说明"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                        <ContentUnitEditor
                          titleForFileName={`${blockTitle}-说明${index + 1}`}
                          placeholder="在此处粘贴文本或拖放文件"
                          unit={supplement}
                          inputId={`supplement-file-${supplement.id}`}
                          enableFileUpload={enableFileUpload}
                          onTextInput={(nextValue) => handleTextInput(collection, block.id, nextValue, supplement.id)}
                          onFileChange={(nextFile) => handleFileChange(collection, block.id, nextFile, supplement.id)}
                          onAlert={alertUser}
                          canApplyFile={(nextFile) => canApplyFileChange(collection, block.id, nextFile, supplement.id)}
                        />
                      </div>
                    ))}

                    {enableLocalSupplements && (
                      <div className="flex justify-end">
                        <Button type="button" variant="ghost" size="sm" onClick={() => addLocalSupplement(collection, block.id)}>
                          <Plus className="mr-1 h-4 w-4" />
                          添加说明
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </section>
    );
  };

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
        <CardContent className="space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <div>当前主文本块：{textBlocks.length} 个 · 整体说明块：{globalSupplementBlocks.length} 个</div>
            <div>上传文件会自动追加 UUID 并按纯文本参与分析。</div>
          </div>

          {renderBlockList('textBlocks', '主文本块', '用于承载实际待审查文本、参考材料或参考评价等主要输入。')}
          {(enableGlobalSupplementBlocks || globalSupplementBlocks.length > 0) &&
            renderBlockList('globalSupplementBlocks', '整体说明块', '用于补充针对整体作品的背景说明、第三方评价或额外参考。')}
        </CardContent>
      </Card>

      <AlertDialog open={pendingTextChange !== null} onOpenChange={(open: boolean) => !open && setPendingTextChange(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>文本长度已超过 100000 字符</AlertDialogTitle>
            <AlertDialogDescription>
              本次输入会使原始块内容总和首次超过上限。点击“继续输入”后，系统会再按渲染后的最终字符串长度校验；若仍超限，本次输入不会生效。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingTextChange(null)}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPendingTextChange}>继续输入</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
