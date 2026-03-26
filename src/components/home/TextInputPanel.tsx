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
import { ContentSource, TextAnnotation, TextBlock, TextBlockAttachment, TextBlockType } from '@/types/report';

interface TextInputPanelProps {
    title?: string;
    description?: string;
    textBlocks: TextBlock[];
    enableFileUpload?: boolean;
    enableAnnotations?: boolean;
    onTextBlocksChange: (value: TextBlock[]) => void;
}

type PendingTextChange = {
    blockId: string;
    annotationId?: string;
    nextText: string;
};

const textBlockTypeOptions: TextBlockType[] = ['actual_text', 'reference_material', 'reference_review'];

function createTextBlock(number: number): TextBlock {
    return {
        id: crypto.randomUUID(),
        number,
        blockType: 'actual_text',
        title: `文本${number}`,
        content: null,
        annotations: [],
    };
}

function createAnnotation(): TextAnnotation {
    return {
        id: crypto.randomUUID(),
        content: null,
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

function getNextBlockNumber(textBlocks: TextBlock[]) {
    return textBlocks.reduce((max, block) => Math.max(max, block.number), 0) + 1;
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

function toTextContent(nextText: string): ContentSource | null {
    return nextText === '' ? null : { kind: 'text', text: nextText };
}

type ContentSourceEditorProps = {
    titleForFileName: string;
    placeholder: string;
    content: ContentSource | null;
    inputId: string;
    enableFileUpload: boolean;
    onTextInput: (nextValue: string) => void;
    onFileChange: (nextFile: TextBlockAttachment | null) => void;
    onAlert: (message: string) => void;
    canApplyFile: (nextFile: TextBlockAttachment) => boolean;
};

function ContentSourceEditor({
    titleForFileName,
    placeholder,
    content,
    inputId,
    enableFileUpload,
    onTextInput,
    onFileChange,
    onAlert,
    canApplyFile,
}: ContentSourceEditorProps) {
    const file = content?.kind === 'file' ? content.file : null;
    const textValue = content?.kind === 'text' ? content.text : '';

    const applyFile = async (fileToUpload: File) => {
        if (!isPlainTextFile(fileToUpload)) {
            onAlert('当前仅支持上传 txt/plain text 文件。');
            return;
        }

        const nextFile = await buildStoredFile(fileToUpload, titleForFileName);
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
            {file ? (
                <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                            <div className="font-medium text-slate-900">{file.originalName}</div>
                            <div className="text-sm text-slate-500">
                                引用名：{file.storedName} · {getFileDisplaySize(file.size)}
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
                        value={textValue}
                        onInput={(event: FormEvent<HTMLTextAreaElement>) => onTextInput(event.currentTarget.value)}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
                        <span>
                            {enableFileUpload
                                ? '可直接输入文本，或拖放 / 选择单个 txt 文件。选择文件后会替换当前文本。'
                                : '当前配置仅支持纯文本输入。'}
                        </span>
                        <span>
                            {textValue.length} / {MAX_BLOCK_CONTENT_LENGTH}
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
    description = '支持多个文本块及块内批注。上传 txt 文件后会保留带 UUID 的文件名引用，并将正文转为字符串进入分析链路。',
    textBlocks,
    enableFileUpload = true,
    enableAnnotations = true,
    onTextBlocksChange,
}: TextInputPanelProps) {
    const nextBlockNumberRef = useRef(getNextBlockNumber(textBlocks));
    const [pendingTextChange, setPendingTextChange] = useState<PendingTextChange | null>(null);
    const [hasConfirmedOverflow, setHasConfirmedOverflow] = useState(false);

    useEffect(() => {
        nextBlockNumberRef.current = Math.max(nextBlockNumberRef.current, getNextBlockNumber(textBlocks));
    }, [textBlocks]);

    useEffect(() => {
        if (getTextBlockPlainTextLength({ textBlocks }) <= MAX_BLOCK_CONTENT_LENGTH) {
            setHasConfirmedOverflow(false);
        }
    }, [textBlocks]);

    const alertUser = (message: string) => {
        window.alert(message);
    };

    const allocateBlockNumber = () => {
        const nextNumber = Math.max(nextBlockNumberRef.current, getNextBlockNumber(textBlocks));
        nextBlockNumberRef.current = nextNumber + 1;
        return nextNumber;
    };

    const updateBlocks = (updater: (blocks: TextBlock[]) => TextBlock[]) => {
        onTextBlocksChange(updater(textBlocks));
    };

    const updateBlock = (blockId: string, updater: (block: TextBlock) => TextBlock) => {
        updateBlocks((blocks) => blocks.map((block) => (block.id === blockId ? updater(block) : block)));
    };

    const buildNextBlocks = (blockId: string, nextContent: ContentSource | null, annotationId?: string) =>
        textBlocks.map((block) => {
            if (block.id !== blockId) {
                return block;
            }

            if (!annotationId) {
                return {
                    ...block,
                    content: nextContent,
                };
            }

            return {
                ...block,
                annotations: block.annotations.map((annotation) =>
                    annotation.id === annotationId
                        ? {
                            ...annotation,
                            content: nextContent,
                        }
                        : annotation,
                ),
            };
        });

    const findCurrentContent = (blockId: string, annotationId?: string) => {
        const block = textBlocks.find((item) => item.id === blockId);
        if (!block) {
            return null;
        }

        if (!annotationId) {
            return block.content;
        }

        return block.annotations.find((annotation) => annotation.id === annotationId)?.content ?? null;
    };

    const handleTextInput = (blockId: string, nextText: string, annotationId?: string) => {
        const currentRawLength = getTextBlockPlainTextLength({ textBlocks });
        const currentContent = findCurrentContent(blockId, annotationId);
        const currentTextLength = currentContent?.kind === 'text' ? currentContent.text.length : 0;
        const nextRawLength = currentRawLength - currentTextLength + nextText.length;

        if (currentRawLength <= MAX_BLOCK_CONTENT_LENGTH && nextRawLength > MAX_BLOCK_CONTENT_LENGTH && !hasConfirmedOverflow) {
            setPendingTextChange({
                blockId,
                annotationId,
                nextText,
            });
            return;
        }

        const nextBlocks = buildNextBlocks(blockId, toTextContent(nextText), annotationId);
        onTextBlocksChange(nextBlocks);
        if (nextRawLength <= MAX_BLOCK_CONTENT_LENGTH) {
            setHasConfirmedOverflow(false);
        }
    };

    const canApplyFileChange = (blockId: string, nextFile: TextBlockAttachment, annotationId?: string) => {
        const nextBlocks = buildNextBlocks(blockId, { kind: 'file', file: nextFile }, annotationId);
        const nextInput = { textBlocks: nextBlocks };

        if (getTextBlockPlainTextLength(nextInput) > MAX_BLOCK_CONTENT_LENGTH) {
            alertUser(`当前总文本长度不能超过 ${MAX_BLOCK_CONTENT_LENGTH} 字符，请删减后再上传。`);
            return false;
        }

        if (getRenderedTextBlockLength(nextInput) > MAX_BLOCK_CONTENT_LENGTH) {
            alertUser(`渲染后的文本长度超过 ${MAX_BLOCK_CONTENT_LENGTH} 字符，请删减后再上传。`);
            return false;
        }

        return true;
    };

    const handleFileChange = (blockId: string, nextFile: TextBlockAttachment | null, annotationId?: string) => {
        const nextBlocks = buildNextBlocks(blockId, nextFile ? { kind: 'file', file: nextFile } : null, annotationId);
        const nextInput = { textBlocks: nextBlocks };

        onTextBlocksChange(nextBlocks);
        if (getTextBlockPlainTextLength(nextInput) <= MAX_BLOCK_CONTENT_LENGTH) {
            setHasConfirmedOverflow(false);
        }
    };

    const addBlock = () => {
        updateBlocks((blocks) => [...blocks, createTextBlock(allocateBlockNumber())]);
    };

    const removeBlock = (blockId: string) => {
        updateBlocks((blocks) => blocks.filter((block) => block.id !== blockId));
    };

    const addAnnotation = (blockId: string) => {
        updateBlock(blockId, (block) => ({
            ...block,
            annotations: [...block.annotations, createAnnotation()],
        }));
    };

    const removeAnnotation = (blockId: string, annotationId: string) => {
        updateBlock(blockId, (block) => ({
            ...block,
            annotations: block.annotations.filter((annotation) => annotation.id !== annotationId),
        }));
    };

    const confirmPendingTextChange = () => {
        if (!pendingTextChange) {
            return;
        }

        const nextBlocks = buildNextBlocks(
            pendingTextChange.blockId,
            toTextContent(pendingTextChange.nextText),
            pendingTextChange.annotationId,
        );
        const nextInput = { textBlocks: nextBlocks };

        if (getRenderedTextBlockLength(nextInput) > MAX_BLOCK_CONTENT_LENGTH) {
            alertUser(`渲染后的文本长度超过 ${MAX_BLOCK_CONTENT_LENGTH} 字符，本次输入未生效。`);
            setPendingTextChange(null);
            return;
        }

        onTextBlocksChange(nextBlocks);
        setHasConfirmedOverflow(getTextBlockPlainTextLength(nextInput) > MAX_BLOCK_CONTENT_LENGTH);
        setPendingTextChange(null);
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
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">
                            共 {textBlocks.length} 个文本块
                        </div>
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
                            textBlocks.map((block) => {
                                const displayTitle = block.title.trim() || `文本块 ${block.number}`;
                                const blockTitle = block.title.trim() || `文本${block.number}`;

                                return (
                                    <div key={block.id} className="space-y-4 rounded-xl border border-slate-200 p-4 shadow-sm">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                <Input
                                                    id={`title-${block.id}`}
                                                    value={block.title}
                                                    placeholder={`文本块 ${block.number}`}
                                                    className="h-9 w-auto min-w-[120px] max-w-[240px] border-0 bg-transparent px-0 text-base font-semibold text-slate-900 shadow-none focus-visible:ring-0"
                                                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                                        updateBlock(block.id, (current) => ({
                                                            ...current,
                                                            title: event.target.value,
                                                        }))
                                                    }
                                                />
                                                <Select
                                                    value={block.blockType}
                                                    onValueChange={(value: string) =>
                                                        updateBlock(block.id, (current) => ({
                                                            ...current,
                                                            blockType: value as TextBlockType,
                                                        }))
                                                    }
                                                >
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
                                                {enableAnnotations && (
                                                    <Button type="button" variant="ghost" size="sm" onClick={() => addAnnotation(block.id)} aria-label="添加批注">
                                                        <Plus className="h-4 w-4" />
                                                        批注
                                                    </Button>
                                                )}
                                                <Button type="button" variant="ghost" size="icon" onClick={() => removeBlock(block.id)} aria-label="删除文本块">
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
                                            onTextInput={(nextValue) => handleTextInput(block.id, nextValue)}
                                            onFileChange={(nextFile) => handleFileChange(block.id, nextFile)}
                                            onAlert={alertUser}
                                            canApplyFile={(nextFile) => canApplyFileChange(block.id, nextFile)}
                                        />

                                        {(block.annotations.length > 0) && (
                                            <div className="space-y-2 pt-2">
                                                {block.annotations.map((annotation, index) => (
                                                    <div key={annotation.id} className="space-y-2 rounded-lg border border-slate-200 bg-muted/30 p-3">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <span className="text-xs font-medium text-muted-foreground">批注 {index + 1}</span>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-6 w-6"
                                                                onClick={() => removeAnnotation(block.id, annotation.id)}
                                                                aria-label="移除批注"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-red-500" />
                                                            </Button>
                                                        </div>
                                                        <ContentSourceEditor
                                                            titleForFileName={`${blockTitle}-批注${index + 1}`}
                                                            placeholder="补充背景、评价或限制信息"
                                                            content={annotation.content}
                                                            inputId={`annotation-file-${annotation.id}`}
                                                            enableFileUpload={enableFileUpload}
                                                            onTextInput={(nextValue) => handleTextInput(block.id, nextValue, annotation.id)}
                                                            onFileChange={(nextFile) => handleFileChange(block.id, nextFile, annotation.id)}
                                                            onAlert={alertUser}
                                                            canApplyFile={(nextFile) => canApplyFileChange(block.id, nextFile, annotation.id)}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </section>
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
