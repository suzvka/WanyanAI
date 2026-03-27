'use client';

import type { TextBlock } from '@/types/report';
import TextBlocksEditor from '@/features/text-blocks/components/TextBlocksEditor';

interface TextInputPanelProps {
    title?: string;
    description?: string;
    textBlocks: TextBlock[];
    enableFileUpload?: boolean;
    enableAnnotations?: boolean;
    onTextBlocksChange: (value: TextBlock[]) => void;
}

export default function TextInputPanel(props: TextInputPanelProps) {
    return <TextBlocksEditor {...props} />;
}
