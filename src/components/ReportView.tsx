'use client';

import { AnalysisReport } from '@/types/report';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ArrowLeft, 
  Download, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  XCircle,
  Trophy,
  BarChart3,
  Target,
  FileText,
  TrendingUp
} from 'lucide-react';

interface ReportViewProps {
  report: AnalysisReport;
  onReset: () => void;
}

export default function ReportView({ report, onReset }: ReportViewProps) {
  // 格式化数字，保留2位小数，如果是整数则不显示小数
  const formatNumber = (num: number): string => {
    const n = Number(num);
    // 如果是整数，直接返回整数形式
    if (Number.isInteger(n)) {
      return n.toString();
    }
    // 否则保留2位小数
    return n.toFixed(2);
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'text-green-600 bg-green-50';
      case 'B': return 'text-blue-600 bg-blue-50';
      case 'C': return 'text-yellow-600 bg-yellow-50';
      case 'D': return 'text-orange-600 bg-orange-50';
      case 'E': return 'text-red-600 bg-red-50';
      default: return 'text-slate-600 bg-slate-50';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'border-red-200 bg-red-50';
      case 'medium': return 'border-yellow-200 bg-yellow-50';
      case 'low': return 'border-blue-200 bg-blue-50';
      default: return 'border-slate-200 bg-slate-50';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high': return <XCircle className="w-5 h-5 text-red-600" />;
      case 'medium': return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      case 'low': return <AlertCircle className="w-5 h-5 text-blue-600" />;
      default: return <AlertCircle className="w-5 h-5 text-slate-600" />;
    }
  };

  const getRecommendationIcon = (recommendation: string) => {
    switch (recommendation) {
      case 'publish': return <CheckCircle2 className="w-6 h-6 text-green-600" />;
      case 'revise_then_publish': return <AlertCircle className="w-6 h-6 text-yellow-600" />;
      case 'rework': return <XCircle className="w-6 h-6 text-red-600" />;
      default: return <AlertCircle className="w-6 h-6 text-slate-600" />;
    }
  };

  const getRecommendationText = (recommendation: string) => {
    switch (recommendation) {
      case 'publish': return '建议发布';
      case 'revise_then_publish': return '修改后发布';
      case 'rework': return '建议重构';
      default: return '待定';
    }
  };

  const getRecommendationColor = (recommendation: string) => {
    switch (recommendation) {
      case 'publish': return 'border-green-200 bg-green-50';
      case 'revise_then_publish': return 'border-yellow-200 bg-yellow-50';
      case 'rework': return 'border-red-200 bg-red-50';
      default: return 'border-slate-200 bg-slate-50';
    }
  };

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
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="md:col-span-1">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-600" />
                    总体评分
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center space-y-4">
                    <div className="relative">
                      <div className="text-6xl font-bold" style={{ color: report.dashboard.totalScore >= 80 ? '#059669' : report.dashboard.totalScore >= 60 ? '#d97706' : '#dc2626' }}>
                        {formatNumber(report.dashboard.totalScore)}
                      </div>
                      <div className="text-sm text-slate-500">总分 100</div>
                    </div>
                    <Badge className={`text-lg px-4 py-1 ${getGradeColor(report.dashboard.grade)}`}>
                      等级 {report.dashboard.grade}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Target className="w-5 h-5 text-blue-600" />
                    最终建议
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`p-6 rounded-lg border-2 ${getRecommendationColor(report.conclusion.finalRecommendation)}`}>
                    <div className="flex items-start gap-4">
                      {getRecommendationIcon(report.conclusion.finalRecommendation)}
                      <div className="flex-1">
                        <h3 className="text-xl font-bold mb-2">
                          {getRecommendationText(report.conclusion.finalRecommendation)}
                        </h3>
                        <p className="text-slate-700 leading-relaxed">
                          {report.conclusion.rationale}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
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
                <Card>
                  <CardHeader>
                    <CardTitle>分维度评分</CardTitle>
                    <CardDescription>各维度的详细评分情况</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {report.dimensions.map((dimension) => (
                        <div key={dimension.dimensionKey} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{dimension.dimensionName}</span>
                              <Badge className={getGradeColor(dimension.grade)}>
                                {dimension.grade}
                              </Badge>
                            </div>
                            <span className="text-sm font-bold" style={{ color: dimension.score >= 80 ? '#059669' : dimension.score >= 60 ? '#d97706' : '#dc2626' }}>
                              {formatNumber(dimension.score)}分
                            </span>
                          </div>
                          <Progress value={dimension.score} className="h-2" />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="issues" className="space-y-6 pt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>核心问题</CardTitle>
                    <CardDescription>需要优先解决的主要问题</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {report.keyIssues.map((issue) => (
                        <div key={issue.id} className={`p-4 rounded-lg border ${getSeverityColor(issue.severity)}`}>
                          <div className="flex items-start gap-3">
                            {getSeverityIcon(issue.severity)}
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-semibold">{issue.title}</h4>
                                <Badge variant="outline" className={issue.severity === 'high' ? 'text-red-600 border-red-200' : issue.severity === 'medium' ? 'text-yellow-600 border-yellow-200' : 'text-blue-600 border-blue-200'}>
                                  {issue.severity === 'high' ? '高优先级' : issue.severity === 'medium' ? '中优先级' : '低优先级'}
                                </Badge>
                              </div>
                              <p className="text-slate-700 mb-3">{issue.description}</p>
                              <div className="bg-white bg-opacity-50 p-3 rounded">
                                <p className="text-sm font-medium text-slate-700">💡 建议方向：</p>
                                <p className="text-sm text-slate-600">{issue.suggestionDirection}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="dimensions" className="space-y-6 pt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>分维度详细分析</CardTitle>
                    <CardDescription>各维度的优势和改进空间</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[600px] pr-4">
                      <div className="space-y-6">
                        {report.dimensions.map((dimension) => (
                          <div key={dimension.dimensionKey} className="space-y-4">
                            <div className="flex items-center justify-between">
                              <h3 className="text-lg font-semibold">{dimension.dimensionName}</h3>
                              <div className="flex items-center gap-3">
                                <span className="text-2xl font-bold" style={{ color: dimension.score >= 80 ? '#059669' : dimension.score >= 60 ? '#d97706' : '#dc2626' }}>
                                  {formatNumber(dimension.score)}
                                </span>
                                <Badge className={getGradeColor(dimension.grade)}>
                                  {dimension.grade}
                                </Badge>
                              </div>
                            </div>
                            
                            <div className="grid md:grid-cols-2 gap-4">
                              <div className="bg-green-50 p-4 rounded-lg">
                                <h4 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                                  <CheckCircle2 className="w-4 h-4" />
                                  优势
                                </h4>
                                <ul className="space-y-2">
                                  {dimension.strengths.map((strength, index) => (
                                    <li key={index} className="text-sm text-green-700 flex items-start gap-2">
                                      <span className="text-green-600 mt-1">•</span>
                                      {strength}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              
                              <div className="bg-yellow-50 p-4 rounded-lg">
                                <h4 className="font-semibold text-yellow-800 mb-2 flex items-center gap-2">
                                  <AlertCircle className="w-4 h-4" />
                                  改进空间
                                </h4>
                                <ul className="space-y-2">
                                  {dimension.weaknesses.map((weakness, index) => (
                                    <li key={index} className="text-sm text-yellow-700 flex items-start gap-2">
                                      <span className="text-yellow-600 mt-1">•</span>
                                      {weakness}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                            
                            <Separator />
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="summary" className="space-y-6 pt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>分析摘要</CardTitle>
                    <CardDescription>本次分析的总体概述</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div className="prose max-w-none">
                        <h3 className="text-lg font-semibold mb-2">{report.summary.title}</h3>
                        <p className="text-slate-700 leading-relaxed">{report.summary.overview}</p>
                      </div>
                      
                      <Separator />
                      
                      <div className="grid md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-slate-500">报告ID：</span>
                          <span className="font-mono">{report.reportId}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">生成时间：</span>
                          <span>{new Date(report.generatedAt).toLocaleString('zh-CN')}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">框架版本：</span>
                          <span>{report.meta.frameworkVersion}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">模型：</span>
                          <span>{report.meta.model}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>快速概览</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center p-4 bg-slate-50 rounded-lg">
                    <div className="text-3xl font-bold mb-1" style={{ color: report.dashboard.totalScore >= 80 ? '#059669' : report.dashboard.totalScore >= 60 ? '#d97706' : '#dc2626' }}>
                      {formatNumber(report.dashboard.totalScore)}
                    </div>
                    <div className="text-sm text-slate-500">总分</div>
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">等级</span>
                      <Badge className={getGradeColor(report.dashboard.grade)}>
                        {report.dashboard.grade}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">发布准备度</span>
                      <span className="text-sm font-medium">{report.dashboard.publishReadiness}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">问题数量</span>
                      <span className="text-sm font-medium">{report.keyIssues.length}个</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>操作建议</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Button onClick={onReset} variant="outline" className="w-full">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    分析新文本
                  </Button>
                  <Button onClick={handleDownload} className="w-full">
                    <Download className="w-4 h-4 mr-2" />
                    下载报告
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
