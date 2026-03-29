'use client';

import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import {
  AlertCircle,
  ArrowLeft,
  CircleHelp,
  Loader2,
  RefreshCw,
  Settings2,
  Sparkles,
  UserRound,
  Wrench,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import BrandBackground from '@/components/ui/brand-background';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EvaluationInput, TextBlock } from '@/types/report';
import type { AnalysisPhase, AnalysisStatus } from '@/types/appFlow';
import ReportView from '@/components/ReportView';
import AppShell from '@/components/layout/AppShell';
import { useEvaluationForm } from '@/hooks/useEvaluationForm';
import { validateEvaluationInput } from '@/lib/validation/evaluationInput';
import type { PublishedOpsConfig } from '@/server/config/types';
import AnalysisControlsPanel from '@/features/analysis-controls/components/AnalysisControlsPanel';
import { useAnalysisControls } from '@/features/analysis-controls/hooks/useAnalysisControls';
import { useAnalysisFlow } from '@/features/analysis-flow/hooks/useAnalysisFlow';
import ApiConfigManagerDialog from '@/features/model-config/components/ApiConfigManagerDialog';
import ModelSelector from '@/features/model-config/components/ModelSelector';
import { useModelConfigController } from '@/features/model-config/hooks/useModelConfigController';
import TextBlocksEditor from '@/features/text-blocks/components/TextBlocksEditor';

// 三种文本块类型的配置
const TEXT_BLOCK_CATEGORIES = [
  { blockType: 'actual_text', title: '正文', defaultExpanded: true },
  { blockType: 'reference_material', title: '参考内容', defaultExpanded: false },
  { blockType: 'reference_review', title: '参考评价', defaultExpanded: false },
] as const;

const phaseSteps: Array<{ key: AnalysisPhase; label: string; description: string }> = [
  { key: 'prepare-upload', label: '准备输入', description: '正在整理文本块、说明和附件元数据。' },
  { key: 'fetch-template', label: '获取模板', description: '正在按当前评价目标拉取提示词模板。' },
  { key: 'build-prompt', label: '构建提示词', description: '正在将输入内容和模板槽位拼接成最终请求。' },
  { key: 'request-model', label: '请求模型', description: '模型正在生成分析结果，请稍候。' },
  { key: 'extract-json', label: '提取 JSON', description: '正在从模型返回中提取结构化内容。' },
  { key: 'repair-json', label: '修复结构', description: '检测到格式异常时，系统会自动尝试修复一次。' },
  { key: 'normalize-report', label: '生成报告', description: '正在校验字段并生成最终展示报告。' },
];

function AnalysisProgressState({
  phase,
  status,
  message,
  canRetry,
  runningTitle,
  runningDescription,
  onRetry,
  onBack,
}: {
  phase: AnalysisPhase;
  status: AnalysisStatus;
  message?: string;
  canRetry: boolean;
  runningTitle: string;
  runningDescription: string;
  onRetry: () => void;
  onBack: () => void;
}) {
  const activeIndex = phaseSteps.findIndex((step) => step.key === phase);
  const currentStep = phaseSteps[activeIndex] || phaseSteps[0];
  const progressPercent = Math.round(((activeIndex + 1) / phaseSteps.length) * 100);

  const header =
    status === 'failed'
      ? {
          icon: <AlertCircle className="h-10 w-10 text-[color:var(--report-danger)]" />,
          title: '分析已中断',
          description: '可以返回修改输入，或在当前参数下重新生成。',
        }
      : status === 'recovering'
        ? {
            icon: <Wrench className="h-10 w-10 text-[color:var(--report-warning)]" />,
            title: '正在修复分析结果...',
            description: '模型返回结构存在异常，系统正在自动恢复。',
          }
        : {
            icon: <Loader2 className="h-10 w-10 animate-spin text-[color:var(--report-score-medium)]" />,
            title: runningTitle,
            description: runningDescription,
          };

  return (
    <div key={`${status}-${phase}`} className="motion-panel-in flex min-h-[60vh] flex-col items-center justify-center space-y-8">
      {/* 顶部图标和标题 */}
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[color:var(--report-surface)] shadow-sm">
          {header.icon}
        </div>
        <h2 className="text-2xl font-bold text-[color:var(--report-text-heading)]">{header.title}</h2>
        <p className="mx-auto max-w-md text-[color:var(--report-text-subtle)]">{message || header.description}</p>
      </div>

      {/* 进度条区域 */}
      <div className="w-full max-w-md space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-[color:var(--report-text-heading)]">{currentStep.label}</span>
          <span className="text-[color:var(--report-text-subtle)]">{progressPercent}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--report-surface-strong)]">
          <div
            className="h-full rounded-full bg-[color:var(--report-score-medium)] transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="text-sm text-[color:var(--report-text-subtle)]">{currentStep.description}</p>
      </div>

      {/* 失败状态按钮 */}
      {status === 'failed' && (
        <div className="flex flex-col gap-3 sm:flex-row">
          {canRetry && (
            <Button onClick={onRetry} className="min-w-[140px]">
              <RefreshCw className="mr-2 h-4 w-4" />
              重新生成
            </Button>
          )}
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回修改输入
          </Button>
        </div>
      )}
    </div>
  );
}

interface HomeClientProps {
  opsConfig: PublishedOpsConfig;
  initialEvaluationInput: EvaluationInput;
}

export default function HomeClient({ opsConfig, initialEvaluationInput }: HomeClientProps) {
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const { site, featureFlags } = opsConfig;
  const {
    formData,
    formErrors,
    updateField,
    validate,
    setFormError,
    clearError,
    analysisPhase,
    analysisStatus,
    analysisMessage,
    canRetryAnalysis,
    startAnalysis,
    updateAnalysisProgress,
    markAnalysisFailed,
    resetAnalysisState,
  } = useEvaluationForm(initialEvaluationInput, {
    featureFlags: opsConfig.featureFlags,
  });

  const {
    apiConfigs,
    selectedConfigId,
    selectedConfig,
    currentModelConfig,
    isConfigBusy,
    createConfig,
    updateConfig,
    deleteConfig,
    selectConfig,
    selectModel,
  } = useModelConfigController({
    onConfigInteraction: () => clearError('form'),
  });

  const { dynamicControls, activeControlSelections, handleControlChange } = useAnalysisControls({
    opsConfig,
    formData,
    initialEvaluationInput,
    updateField,
    clearError,
  });

  // 按 blockType 分组文本块
  const textBlocksByType = useMemo(() => {
    const groups: Record<string, TextBlock[]> = {};
    TEXT_BLOCK_CATEGORIES.forEach(({ blockType }) => {
      groups[blockType] = formData.textBlocks.filter((block: TextBlock) => block.blockType === blockType);
    });
    return groups;
  }, [formData.textBlocks]);

  // 处理单个容器的文本块变化
  const handleTextBlocksChangeByType = (blockType: string, updatedBlocks: TextBlock[]) => {
    const otherBlocks = formData.textBlocks.filter((block: TextBlock) => block.blockType !== blockType);
    const nextBlocks = [...otherBlocks, ...updatedBlocks];
    // 按原始顺序排序（保持 number 字段）
    nextBlocks.sort((a, b) => a.number - b.number);
    updateField('textBlocks', nextBlocks);
  };

  const isSubmittingAnalysis = analysisStatus === 'running' || analysisStatus === 'recovering';
  const settingsDescription =
    dynamicControls.length > 0
      ? site.settingsPanel.description
      : opsConfig.source === 'fallback'
        ? '当前未加载动态分析配置，将使用系统默认值。'
        : undefined;

  const {
    appStep,
    report,
    isOpsConfigStaleDialogOpen,
    setIsOpsConfigStaleDialogOpen,
    handleSubmit,
    handleRetryAnalysis,
    handleBackToInput,
    handleReset,
  } = useAnalysisFlow({
    opsConfig,
    currentModelConfig,
    hasSelectedConfig: Boolean(selectedConfig),
    activeControlSelections,
    validate,
    setFormError,
    clearError,
    analysisStatus,
    analysisMessage,
    startAnalysis,
    updateAnalysisProgress,
    markAnalysisFailed,
    resetAnalysisState,
    onRequireConfig: () => setIsConfigDialogOpen(true),
  });

  // 包装 handleSubmit，每次点击时先验证，失败则显示 toast
  const handleButtonClick = () => {
    // 先调用 validateEvaluationInput 获取验证结果
    const result = validateEvaluationInput(formData, { featureFlags });
    if (!result.success) {
      const error = result.errors.form || result.errors.textBlocks;
      if (error) {
        toast.error('输入有误', {
          description: error,
          style: {
            borderColor: '#dc2626',
          },
        });
      }
      // 仍然调用 validate 来更新 formErrors 状态
      validate();
      return;
    }
    // 验证成功，调用 handleSubmit
    handleSubmit();
  };

  return (
    <>
      {/* 品牌背景层 */}
      <BrandBackground appearance={opsConfig.appearance} />
      
      <AppShell
        siteTitle={site.home.title}
        primaryColor={opsConfig.appearance.theme.primary}
        headerCenter={
          <div className="w-full max-w-[15rem] sm:max-w-xs md:max-w-sm lg:max-w-md">
            <ModelSelector
              selectedConfig={selectedConfig}
              disabled={isConfigBusy}
              onSelectModel={selectModel}
            />
          </div>
        }
        headerActions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="icon" className="size-9">
                <Settings2 className="size-4" />
                <span className="sr-only">更多选项</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>更多功能</DropdownMenuLabel>
              <DropdownMenuItem disabled>
                <UserRound className="mr-2 h-4 w-4" />
                个人中心（预留）
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <Settings2 className="mr-2 h-4 w-4" />
                偏好设置（预留）
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <CircleHelp className="mr-2 h-4 w-4" />
                帮助与反馈（预留）
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setIsConfigDialogOpen(true)}>
                <Settings2 className="mr-2 h-4 w-4" />
                管理配置
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      >
        {appStep === 'report' && report ? (
          <ReportView report={report} onReset={handleReset} />
        ) : (
          <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
            {appStep === 'input' ? (
              <div className="space-y-6">
                {/* 顶部：分析设置面板 */}
                <AnalysisControlsPanel
                  title={site.settingsPanel.title}
                  description={settingsDescription}
                  groups={opsConfig.analysisControls.groups}
                  controls={dynamicControls}
                  controlSelections={activeControlSelections}
                  isSubmitting={isSubmittingAnalysis}
                  onControlChange={handleControlChange}
                />

                {/* 中部：文本输入面板（三个独立容器） */}
                {TEXT_BLOCK_CATEGORIES.map(({ blockType, title, defaultExpanded }) => (
                  <TextBlocksEditor
                    key={blockType}
                    title={title}
                    textBlocks={textBlocksByType[blockType] || []}
                    enableFileUpload={featureFlags.enableFileUpload}
                    enableAnnotations={featureFlags.enableAnnotations}
                    fixedBlockType={blockType}
                    defaultExpanded={defaultExpanded}
                    onTextBlocksChange={(value) => handleTextBlocksChangeByType(blockType, value)}
                  />
                ))}

                {/* 底部：开始分析按钮 */}
                <div className="pt-2">
                  <Button
                    className="h-14 w-full text-lg select-none"
                    onClick={handleButtonClick}
                    disabled={isSubmittingAnalysis}
                  >
                    {isSubmittingAnalysis ? (
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-5 w-5" />
                    )}
                    {isSubmittingAnalysis ? '分析进行中...' : '开始分析'}
                  </Button>
                </div>
              </div>
            ) : (
              <AnalysisProgressState
                phase={analysisPhase}
                status={analysisStatus}
                message={analysisMessage}
                canRetry={canRetryAnalysis}
                runningTitle={site.progress.runningTitle}
                runningDescription={site.progress.runningDescription}
                onRetry={handleRetryAnalysis}
                onBack={handleBackToInput}
              />
            )}
          </main>
        )}
      </AppShell>

      <ApiConfigManagerDialog
        open={isConfigDialogOpen}
        selectedConfigId={selectedConfigId}
        configs={apiConfigs}
        busy={isConfigBusy}
        onOpenChange={setIsConfigDialogOpen}
        onSelectConfig={selectConfig}
        onCreateConfig={createConfig}
        onUpdateConfig={updateConfig}
        onDeleteConfig={deleteConfig}
      />

      <AlertDialog open={isOpsConfigStaleDialogOpen} onOpenChange={setIsOpsConfigStaleDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>页面配置已更新</AlertDialogTitle>
            <AlertDialogDescription>
              当前动态检查策略已发生变化。请先保存或复制当前输入内容，再手动刷新页面以加载最新配置。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setIsOpsConfigStaleDialogOpen(false)}>我知道了</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
