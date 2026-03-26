'use client';

import { AnalysisReport } from '@/types/report';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, Sparkles } from 'lucide-react';
import ReportBodySections from '@/components/report/ReportBodySections';
import ReportSidebar from '@/components/report/ReportSidebar';
import ReportSummaryCard from '@/components/report/ReportSummaryCard';

interface ReportViewProps {
  report: AnalysisReport;
  onReset: () => void;
}

export default function ReportView({ report, onReset }: ReportViewProps) {
  const sections = report.sections ?? [];

  const handleDownload = () => {
    const dataStr = JSON.stringify(report, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `report-${report.reportId}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={onReset} className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                返回
              </Button>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600 rounded-lg">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900">分析报告</h1>
                  <p className="text-sm text-slate-500">{report.summary.title}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={handleDownload} variant="outline" className="flex items-center gap-2">
                <Download className="w-4 h-4" />
                导出报告
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <ReportSummaryCard report={report} />
            <ReportBodySections sections={sections} />
          </div>

          <ReportSidebar report={report} onReset={onReset} onDownload={handleDownload} />
        </div>
      </main>
    </div>
  );
}
