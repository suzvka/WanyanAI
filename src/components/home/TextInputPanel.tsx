'use client';

import { FileText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

interface TextInputPanelProps {
  textContent: string;
  onTextContentChange: (value: string) => void;
}

export default function TextInputPanel({ textContent, onTextContentChange }: TextInputPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          文本内容
        </CardTitle>
        <CardDescription>请粘贴您要分析的作品内容</CardDescription>
      </CardHeader>
      <CardContent>
        <Textarea
          placeholder="在此粘贴您的文本内容..."
          className="min-h-[400px] font-serif text-lg leading-relaxed"
          value={textContent}
          onChange={(event: { target: { value: string } }) => onTextContentChange(event.target.value)}
        />
        <p className="text-sm text-slate-500 mt-2">字符数: {textContent.length}</p>
      </CardContent>
    </Card>
  );
}
