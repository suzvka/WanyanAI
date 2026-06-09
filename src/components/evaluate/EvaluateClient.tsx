'use client';

import { useState, useMemo, useCallback, useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { showError } from '@/lib/alert';
import {
  AlertCircle,
  ArrowLeft,
  Loader2,
  RefreshCw,
  Sparkles,
  Wrench,
} from 'lucide-react';
import BrandBackground from '@/components/ui/brand-background';
import { Button } from '@/components/ui/button';
import { PageSkeleton } from '@/components/ui/page-skeleton';
import { usePageFirstLoad } from '@/hooks/usePageFirstLoad';
import type { AnalysisPhase, AnalysisStatus } from '@/types/appFlow';
import type { PlatformConfig } from '@/types/platform';
import type { PageModuleConfig, ContainerConfig, PageModulePublicMeta } from '@/types/module';
import type { EvaluationInput, TextBlock } from '@/types/report';
import type { ContainerDataPayload, TextBlocksContainerData } from '@/types/container-data';
import AppShell from '@/components/layout/AppShell';
import { PlatformProvider, usePlatformContext } from '@/providers/PlatformContext';
import { PageProvider, usePageContext } from '@/providers/PageContext';
import { useModelConfig } from '@/providers/ModelConfigProvider';
import { NavigationGuardProvider, useNavigationGuard } from '@/providers/NavigationGuardContext';
import { renderContainer } from '@/containers';
import { renderOutputMode } from '@/features/output-modes';
import { validateEvaluationInput } from '@/lib/validation/evaluationInput';
import { useHasUnsavedContent } from '@/hooks/useHasUnsavedContent';
import type { ProgressSnapshot } from '@/features/analysis-progress';
import { ReportErrorBoundary } from '@/components/evaluate/ReportErrorBoundary';

function AnalysisProgressState({
  phase,
  status,
  canRetry,
  runningTitle,
  runningDescription,
  progressSnapshot,
  onRetry,
  onBack,
  onBackground,
}: {
  phase: AnalysisPhase;
  status: AnalysisStatus;
  canRetry: boolean;
  runningTitle: string;
  runningDescription: string;
  progressSnapshot: ProgressSnapshot;
  onRetry: () => void;
  onBack: () => void;
  onBackground: () => void;
}) {
  // 完全依赖 ProgressController 的进度快照
  const progressPercent = progressSnapshot.progress;
  
  const currentLabel = progressSnapshot.currentLabel || '处理中';
  
  // 进度描述优先使用事件级标签（currentEventLabel），然后是状态标签
  const currentDescription = 
    progressSnapshot.currentEventLabel || 
    progressSnapshot.currentLabel ||
    '';

  const header =
    status === 'failed' || progressSnapshot.status === 'error'
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
        <p className="mx-auto max-w-md text-[color:var(--report-text-subtle)]">{header.description}</p>
      </div>

      {/* 进度条区域 */}
      <div className="w-full max-w-md space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-[color:var(--report-text-heading)]">{currentLabel}</span>
          <span className="text-[color:var(--report-text-subtle)]">{progressPercent}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--report-surface-strong)]">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${
              progressSnapshot.status === 'error' 
                ? 'bg-[color:var(--report-danger)]' 
                : 'bg-[color:var(--report-score-medium)]'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="text-sm text-[color:var(--report-text-subtle)]">{currentDescription}</p>
      </div>

      {status !== 'failed' && progressSnapshot.status !== 'error' && (
        <Button variant="outline" onClick={onBackground}>
          后台进行
        </Button>
      )}

      {/* 失败状态按钮 */}
      {(status === 'failed' || progressSnapshot.status === 'error') && (
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

/**
 * 分析按钮组件
 */
function AnalysisButton({
  isSubmitting,
  onClick,
}: {
  isSubmitting: boolean;
  onClick: () => void;
}) {
  return (
    <div className="pt-2">
      <Button
        className="h-14 w-full text-lg select-none"
        onClick={onClick}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        ) : (
          <Sparkles className="mr-2 h-5 w-5" />
        )}
        {isSubmitting ? '分析进行中...' : '开始分析'}
      </Button>
    </div>
  );
}

/**
 * 提取容器 ID（用于数据关联）
 */
function getContainerId(config: ContainerConfig): string {
  // text-blocks 容器使用 params.id 作为标识
  if (config.type === 'text-blocks' && config.params) {
    return (config.params as { id?: string }).id || config.type;
  }
  // 其他容器使用 type 作为标识
  return config.type;
}

/**
 * 生成唯一 ID
 */
function generateUniqueId(): string {
  // 使用时间戳 + 随机字符串确保唯一性
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * 创建初始文本块
 */
function createInitialTextBlocks(count: number): TextBlock[] {
  if (count <= 0) return [];
  
  const blocks: TextBlock[] = [];
  for (let i = 0; i < count; i++) {
    blocks.push({
      id: `block-${generateUniqueId()}`,
      title: '',
      content: null,
      annotations: [],
    });
  }
  return blocks;
}

/**
 * 根据容器配置获取初始数据
 */
function getInitialContainerData(config: ContainerConfig): ContainerDataPayload {
  switch (config.type) {
    case 'text-blocks': {
      const params = config.params as { initialBlockCount?: number } | undefined;
      const initialBlockCount = params?.initialBlockCount ?? 0;
      return { textBlocks: createInitialTextBlocks(initialBlockCount) };
    }
    // 新增容器类型在此添加初始数据逻辑
    // case 'image-uploader':
    //   return { images: [] };
    default:
      return {};
  }
}

/**
 * 主要内容组件
 */
function EvaluateContent({
  moduleConfig,
  modules,
}: {
  moduleConfig: PageModuleConfig;
  modules: PageModulePublicMeta[];
}) {
  const { appearance, featureFlags } = usePlatformContext();
  const { site } = moduleConfig;
  const {
    analysisState,
    report,
    startAnalysis,
    retryAnalysis,
    resetAnalysis,
    setBackgroundMode,
    progressSnapshot,
  } = usePageContext();
  const { setHasUnsavedContent } = useNavigationGuard();
  const pathname = usePathname();

  // 检测是否首次加载，只在首次显示骨架屏
  const isFirstLoad = usePageFirstLoad();

  // 页面过渡状态
  const [isPageVisible, setIsPageVisible] = useState(false);

  // 路由变化时触发页面过渡动画
  useEffect(() => {
    // 使用 setTimeout 延迟状态更新
    const hideTimer = setTimeout(() => setIsPageVisible(false), 0);
    const showTimer = setTimeout(() => setIsPageVisible(true), 50);
    return () => {
      clearTimeout(hideTimer);
      clearTimeout(showTimer);
    };
  }, [pathname]);

  // === 容器数据状态（通用数据通道）===
  // 按容器 ID 分组存储各类型容器的数据
  const [containersData, setContainersData] = useState<Record<string, ContainerDataPayload>>(() => {
    // 从模块配置初始化，直接创建初始文本块
    const initial: Record<string, ContainerDataPayload> = {};
    const containers = moduleConfig.manifest.containers;
    for (const container of containers) {
      const containerId = getContainerId(container);
      initial[containerId] = getInitialContainerData(container);
    }
    return initial;
  });

  // 检查是否有未保存内容
  const hasUnsavedContent = useHasUnsavedContent(containersData);

  // 同步未保存内容状态到导航守卫
  useEffect(() => {
    setHasUnsavedContent(hasUnsavedContent);
  }, [hasUnsavedContent, setHasUnsavedContent]);

  const isSubmittingAnalysis = analysisState.status === 'running' || analysisState.status === 'recovering';

  // 通用数据更新函数
  const updateContainerData = useCallback((containerId: string, data: ContainerDataPayload) => {
    setContainersData((prev: Record<string, ContainerDataPayload>) => ({
      ...prev,
      [containerId]: data,
    }));
  }, []);

  // 清空所有容器数据（"再来一篇"功能）
  const clearAllContainerData = useCallback(() => {
    const initial: Record<string, ContainerDataPayload> = {};
    const containers = moduleConfig.manifest.containers;
    for (const container of containers) {
      const containerId = getContainerId(container);
      initial[containerId] = getInitialContainerData(container);
    }
    setContainersData(initial);
    resetAnalysis();
  }, [moduleConfig.manifest.containers, resetAnalysis]);

  // 后台进行：只返回输入页面，不重置任务状态
  const handleBackground = useCallback(() => {
    // 不调用 resetAnalysis()，让任务继续在后台运行
    // 只切换 UI 状态，让用户可以输入新内容
    setBackgroundMode();
  }, [setBackgroundMode]);

  // 序列化为 EvaluationInput
  const toEvaluationInput = useCallback((): EvaluationInput => {
    // 收集所有文本块和容器数据
    const allTextBlocks: TextBlock[] = [];
    const containersDataList: EvaluationInput['containers'] = [];
    const containers = moduleConfig.manifest.containers;
    
    for (const container of containers) {
      const containerId = getContainerId(container);
      const data = containersData[containerId];
      
      if (container.type === 'text-blocks') {
        // 类型断言：将通用数据转换为 text-blocks 容器数据
        const textBlocksData = data as TextBlocksContainerData;
        const blocks = textBlocksData?.textBlocks || [];
        const params = container.params as { id?: string; title?: string; prompt?: string } | undefined;
        
        allTextBlocks.push(...blocks);
        
        containersDataList.push({
          id: containerId,
          title: params?.title || containerId,
          prompt: params?.prompt,
          textBlocks: blocks,
        });
      }
      // 新增容器类型在此处理序列化逻辑
    }

    return {
      textBlocks: allTextBlocks,
      containers: containersDataList,
    };
  }, [moduleConfig.manifest.containers, containersData]);

  // 处理分析按钮点击
  const handleButtonClick = useCallback(() => {
    // 验证输入
    const input = toEvaluationInput();
    const result = validateEvaluationInput(input, { featureFlags });
    if (!result.success) {
      const error = result.errors.form || result.errors.textBlocks;
      if (error) {
        showError(error);
      }
      return;
    }

    // 序列化输入
    const textContent = JSON.stringify(input);

    // 调用分析接口
    startAnalysis({ textContent });
  }, [toEvaluationInput, featureFlags, startAnalysis]);

  // 渲染容器列表
  const containerElements = useMemo(() => {
    const containers = moduleConfig.manifest.containers;
    return containers.map((config, index) => {
      const containerId = getContainerId(config);
      
      // 使用通用数据通道传递数据
      return renderContainer(
        config,
        index,
        containers.length,
        {
          data: containersData[containerId],
          onDataChange: (data) => updateContainerData(containerId, data),
        }
      );
    });
  }, [moduleConfig.manifest.containers, containersData, updateContainerData]);

  // 判断当前应该渲染报告还是输入界面
  const shouldShowReport = report !== null && analysisState.status === 'idle';

  // === 条件渲染放在最后！所有 Hook 已声明完毕 ===

  // 首次加载时显示骨架屏
  if (isFirstLoad) {
    return <PageSkeleton type="evaluate" />;
  }

  return (
    <>
      {/* 品牌背景层 */}
      <BrandBackground appearance={appearance} />

      <AppShell
        siteTitle={site.home.title}
        primaryColor={appearance.theme.primary}
      >
        {shouldShowReport ? (
          <ReportErrorBoundary
            onBackToEdit={resetAnalysis}
            onRetry={retryAnalysis}
          >
            {renderOutputMode(moduleConfig.manifest.outputMode, {
              data: report,
              onStartNew: clearAllContainerData,
              onBackToEdit: resetAnalysis,
            })}
          </ReportErrorBoundary>
        ) : analysisState.status !== 'idle' && analysisState.status !== 'failed' ? (
          <main 
            className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8"
            style={{
              opacity: isPageVisible ? 1 : 0,
              transform: isPageVisible ? 'translateY(0)' : 'translateY(16px)',
              transition: `opacity var(--motion-duration-slow) var(--motion-ease-emphasized),
                           transform var(--motion-duration-slow) var(--motion-ease-emphasized)`,
            }}
          >
            <AnalysisProgressState
              phase={analysisState.phase}
              status={analysisState.status}
              canRetry={analysisState.canRetry}
              runningTitle={site.progress.runningTitle}
              runningDescription={site.progress.runningDescription}
              progressSnapshot={progressSnapshot}
              onRetry={retryAnalysis}
              onBack={resetAnalysis}
              onBackground={handleBackground}
            />
          </main>
        ) : (
          <main 
            className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8"
            style={{
              opacity: isPageVisible ? 1 : 0,
              transform: isPageVisible ? 'translateY(0)' : 'translateY(16px)',
              transition: `opacity var(--motion-duration-slow) var(--motion-ease-emphasized),
                           transform var(--motion-duration-slow) var(--motion-ease-emphasized)`,
            }}
          >
            <div className="space-y-6">
              {/* 动态渲染容器列表 */}
              {containerElements}

              {/* 开始分析按钮（自动追加） */}
              <AnalysisButton
                isSubmitting={isSubmittingAnalysis}
                onClick={handleButtonClick}
              />
            </div>
          </main>
        )}
      </AppShell>
    </>
  );
}

interface EvaluateClientProps {
  platformConfig: PlatformConfig;
  moduleConfig: PageModuleConfig;
  modules: PageModulePublicMeta[];
}

export default function EvaluateClient({
  platformConfig,
  moduleConfig,
  modules,
}: EvaluateClientProps) {
  return (
    <PlatformProvider platformConfig={platformConfig}>
      <NavigationGuardProvider>
        <PageProviderWrapper moduleConfig={moduleConfig}>
          <EvaluateContent
            moduleConfig={moduleConfig}
            modules={modules}
          />
        </PageProviderWrapper>
      </NavigationGuardProvider>
    </PlatformProvider>
  );
}

/**
 * PageProvider 包装器
 */
function PageProviderWrapper({
  moduleConfig,
  children,
}: {
  moduleConfig: PageModuleConfig;
  children: ReactNode;
}) {
  const { currentModelConfig, setIsConfigDialogOpen } = useModelConfig();

  return (
    <PageProvider
      moduleConfig={moduleConfig}
      currentModelConfig={currentModelConfig}
      onRequireModelConfig={() => setIsConfigDialogOpen(true)}
    >
      {children}
    </PageProvider>
  );
}
