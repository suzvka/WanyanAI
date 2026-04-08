'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { reportBusinessError } from '@/lib/client-errors/report';
import type { EvaluationInput } from '@/types/report';
import type { AnalysisResult } from '@/types/analysis';
import type { PageModuleConfig } from '@/types/module';
import type { AnalysisPhase, AnalysisStatus } from '@/types/appFlow';
import type { ModelConfig } from '@/types/modelConfig';
import type { ProgressSnapshot } from '@/features/analysis-progress';
import { useAnalysisTasks } from '@/providers/AnalysisTaskProvider';

/**
 * 分析控制选择
 */
export type ControlSelections = Record<string, string>;

/**
 * 分析流程状态
 */
export type AnalysisState = {
  phase: AnalysisPhase;
  status: AnalysisStatus;
  message?: string;
  canRetry: boolean;
};

/**
 * 分析接口参数
 */
export type AnalysisParams = {
  /** 文本块内容（序列化后） */
  textContent: string;
  /** 其他自定义参数 */
  extraParams?: Record<string, unknown>;
};

/**
 * PageContext 值类型
 */
export type PageContextValue = {
  /** 当前模块配置 */
  moduleConfig: PageModuleConfig;

  // === 分析控制 ===
  /** 当前选择的分析控制项 */
  controlSelections: ControlSelections;
  /** 更新分析控制选择 */
  setControlSelections: (selections: ControlSelections) => void;
  /** 更新单个控制项选择 */
  updateControlSelection: (controlId: string, value: string) => void;

  // === 分析流程 ===
  /** 分析状态 */
  analysisState: AnalysisState;
  /** 分析报告（原始数据，由渲染器解释） */
  report: AnalysisResult;
  /** 开始分析 */
  startAnalysis: (params: AnalysisParams) => Promise<AnalysisResult | null>;
  /** 重试分析 */
  retryAnalysis: () => Promise<AnalysisResult | null>;
  /** 重置分析状态 */
  resetAnalysis: () => void;
  /** 后台模式：返回输入页面但保持任务运行 */
  setBackgroundMode: () => void;

  // === 进度快照 ===
  /** 进度快照（供进度条渲染使用） */
  progressSnapshot: ProgressSnapshot;

  // === 模型配置 ===
  /** 当前模型配置 */
  currentModelConfig: ModelConfig | null;
  /** 是否已选择模型配置 */
  hasModelConfig: boolean;
};

const PageContext = createContext<PageContextValue | null>(null);

export function usePageContext(): PageContextValue {
  const context = useContext(PageContext);
  if (!context) {
    throw new Error('usePageContext must be used within a PageProvider');
  }
  return context;
}

export type PageProviderProps = {
  children: ReactNode;
  moduleConfig: PageModuleConfig;
  currentModelConfig: ModelConfig | null;
  onRequireModelConfig?: () => void;
};

export function PageProvider({
  children,
  moduleConfig,
  currentModelConfig,
  onRequireModelConfig,
}: PageProviderProps) {
  const { createTask, getTask, subscribeTask, retryTask, canRetryTask } = useAnalysisTasks();

  // 分析控制选择
  const [controlSelections, setControlSelections] = useState<ControlSelections>(() => {
    const initial: ControlSelections = {};
    for (const control of moduleConfig.analysisControls.controls) {
      if (control.enabled && control.options.length > 0) {
        const enabledOption = control.options.find(opt => opt.enabled);
        if (enabledOption) {
          initial[control.id] = enabledOption.value;
        }
      }
    }
    return initial;
  });

  // 分析状态
  const [analysisState, setAnalysisState] = useState<AnalysisState>({
    phase: 'prepare',
    status: 'idle',
    canRetry: false,
  });

  // 分析报告（原始数据）
  const [report, setReport] = useState<AnalysisResult>(null);

  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [lastTaskId, setLastTaskId] = useState<string | null>(null);

  // 进度快照状态
  const [progressSnapshot, setProgressSnapshot] = useState<ProgressSnapshot>({
    progress: 0,
    currentStage: null,
    currentLabel: '',
    status: 'idle',
  });

  // 更新单个控制项选择
  const updateControlSelection = useCallback((controlId: string, value: string) => {
    setControlSelections((prev: ControlSelections) => ({
      ...prev,
      [controlId]: value,
    }));
  }, []);

  useEffect(() => {
    if (!activeTaskId) {
      return;
    }

    return subscribeTask(activeTaskId, (record) => {
      if (!record) {
        return;
      }

      setProgressSnapshot(record.progressSnapshot);

      if (record.status === 'completed' && record.report) {
        setReport(record.report);
        setAnalysisState({
          phase: 'normalize',
          status: 'idle',
          canRetry: false,
        });
        return;
      }

      if (record.status === 'failed') {
        setReport(null);
        setAnalysisState({
          phase: record.taskMeta.phase,
          status: 'failed',
          message: record.taskMeta.errorMessage || record.taskMeta.message || '分析失败',
          canRetry: canRetryTask(record.id),
        });
        return;
      }

      setReport(null);
      setAnalysisState({
        phase: record.taskMeta.phase,
        status: 'running',
        message: record.taskMeta.message,
        canRetry: false,
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTaskId]);

  // 开始分析
  const startAnalysis = useCallback(async (params: AnalysisParams): Promise<AnalysisResult | null> => {
    if (!currentModelConfig) {
      onRequireModelConfig?.();
      return null;
    }

    try {
      const input = JSON.parse(params.textContent) as EvaluationInput;

      const taskId = await createTask({
        moduleConfig,
        modelConfig: currentModelConfig,
        controlSelections,
        params,
        input,
      });

      if (!taskId) {
        return null;
      }

      const record = getTask(taskId);
      setActiveTaskId(taskId);
      setLastTaskId(taskId);
      setReport(null);

      if (record) {
        setProgressSnapshot(record.progressSnapshot);
        setAnalysisState({
          phase: record.taskMeta.phase,
          status: 'running',
          message: record.taskMeta.message,
          canRetry: false,
        });
      }

      return null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '分析失败';
      reportBusinessError(error, errorMessage);
      setAnalysisState({
        phase: 'prepare',
        status: 'failed',
        message: errorMessage,
        canRetry: true,
      });
      return null;
    }
  }, [controlSelections, createTask, currentModelConfig, getTask, moduleConfig, onRequireModelConfig]);

  // 重试分析
  const retryAnalysis = useCallback(async (): Promise<AnalysisResult | null> => {
    const taskId = activeTaskId ?? lastTaskId;
    if (!taskId) {
      return null;
    }

    const nextTaskId = await retryTask(taskId);
    if (!nextTaskId) {
      return null;
    }

    const record = getTask(nextTaskId);
    setActiveTaskId(nextTaskId);
    setLastTaskId(nextTaskId);
    setReport(null);

    if (record) {
      setProgressSnapshot(record.progressSnapshot);
      setAnalysisState({
        phase: record.taskMeta.phase,
        status: 'running',
        message: record.taskMeta.message,
        canRetry: false,
      });
    }

    return null;
  }, [activeTaskId, getTask, lastTaskId, retryTask]);

  // 重置分析状态
  const resetAnalysis = useCallback(() => {
    setActiveTaskId(null);
    setLastTaskId(null);
    setAnalysisState({
      phase: 'prepare',
      status: 'idle',
      canRetry: false,
    });
    setReport(null);
    setProgressSnapshot({
      progress: 0,
      currentStage: null,
      currentLabel: '',
      status: 'idle',
    });
  }, []);

  // 后台模式：返回输入页面，但保持任务运行
  const setBackgroundMode = useCallback(() => {
    setAnalysisState({
      phase: 'prepare',
      status: 'idle',
      canRetry: false,
    });
  }, []);

  const value = useMemo<PageContextValue>(() => ({
    moduleConfig,
    controlSelections,
    setControlSelections,
    updateControlSelection,
    analysisState,
    report,
    startAnalysis,
    retryAnalysis,
    resetAnalysis,
    setBackgroundMode,
    progressSnapshot,
    currentModelConfig,
    hasModelConfig: Boolean(currentModelConfig),
  }), [
    moduleConfig,
    controlSelections,
    updateControlSelection,
    analysisState,
    report,
    startAnalysis,
    retryAnalysis,
    resetAnalysis,
    setBackgroundMode,
    progressSnapshot,
    currentModelConfig,
  ]);

  return (
    <PageContext.Provider value={value}>
      {children}
    </PageContext.Provider>
  );
}
