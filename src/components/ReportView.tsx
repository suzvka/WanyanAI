'use client';

import { AnalysisReport } from '@/types/report';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, 
  Download, 
  Sparkles, 
  AlertCircle, 
  BarChart3,
  FileText,
  TrendingUp
} from 'lucide-react';
import ReportDimensionsPanel from '@/components/report/ReportDimensionsPanel';
import ReportIssuesPanel from '@/components/report/ReportIssuesPanel';
import ReportMetaPanel from '@/components/report/ReportMetaPanel';
import ReportSidebar from '@/components/report/ReportSidebar';
import ReportSummaryCard from '@/components/report/ReportSummaryCard';

interface ReportViewProps {
  report: AnalysisReport;
  onReset: () => void;
}

export default function ReportView({ report, onReset }: ReportViewProps) {
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
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-3">
            <ReportSummaryCard report={report} />
          </div>

          <div className="lg:col-span-2 space-y-6">
            <Tabs defaultValue="dashboard" className="w-full">
              <TabsList className="w-full grid grid-cols-4">
                <TabsTrigger value="dashboard">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  仪表盘
                </TabsTrigger>
                <TabsTrigger value="issues">
                  <AlertCircle className="w-4 h-4 mr-2" />
                  核心问题
                </TabsTrigger>
                <TabsTrigger value="dimensions">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  分维度分析
                </TabsTrigger>
                <TabsTrigger value="summary">
                  <FileText className="w-4 h-4 mr-2" />
                  摘要
                </TabsTrigger>
              </TabsList>

              <TabsContent value="dashboard" className="space-y-6 pt-6">
                <ReportDimensionsPanel dimensions={report.dimensions} variant="dashboard" />
              </TabsContent>

              <TabsContent value="issues" className="space-y-6 pt-6">
                <ReportIssuesPanel issues={report.keyIssues} />
              </TabsContent>

              <TabsContent value="dimensions" className="space-y-6 pt-6">
                <ReportDimensionsPanel dimensions={report.dimensions} variant="details" />
              </TabsContent>

              <TabsContent value="summary" className="space-y-6 pt-6">
                <ReportMetaPanel report={report} />
              </TabsContent>
            </Tabs>
          </div>

          <div className="lg:col-span-1 space-y-6">
            <ReportSidebar report={report} onReset={onReset} onDownload={handleDownload} />
          </div>
        </div>
      </main>
    </div>
  );
}
