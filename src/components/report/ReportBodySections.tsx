'use client';

import type { ReportSection } from '@/types/report';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ReportBodySectionsProps {
  sections: ReportSection[];
}

function splitParagraphs(body: string) {
  return body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

export default function ReportBodySections({ sections }: ReportBodySectionsProps) {
  if (sections.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">
        暂无可展示的报告正文。
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {sections.map((section, index) => {
        const paragraphs = splitParagraphs(section.body);

        return (
          <Card key={section.id}>
            <CardHeader className="pb-4">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400">章节 {index + 1}</div>
              <CardTitle className="text-xl text-slate-900">{section.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {paragraphs.length > 0 ? (
                paragraphs.map((paragraph, paragraphIndex) => (
                  <p key={`${section.id}-${paragraphIndex}`} className="text-sm leading-7 text-slate-700">
                    {paragraph}
                  </p>
                ))
              ) : (
                <p className="text-sm leading-7 text-slate-700 whitespace-pre-line">{section.body}</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
