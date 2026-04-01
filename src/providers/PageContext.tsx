'use client';

import { createContext, useCallback, useContext, useMemo, useState, useRef, type ReactNode } from 'react';
import { showError } from '@/lib/alert';
import type { EvaluationInput } from '@/types/report';
import type { AnalysisResult } from '@/types/analysis';
import type { ModuleConfig } from '@/types/module';
import type { AnalysisPhase, AnalysisStatus } from '@/types/appFlow';
import type { ModelConfig } from '@/types/modelConfig';
import { modelClient } from '@/services/model-client';
import { PromptTemplateService } from '@/services/analysis/types';
import { ApiAnalysisService } from '@/services/analysis/apiAnalysisService';
import { 
  buildAnalysisMessages, 
  parseModelResponse,
  requestCompiledInstructions 
} from '@/features/analysis-flow/lib';
import { resolveBoundControlLabels } from '@/features/analysis-controls/lib/controlSelection';
import { ProgressController, type ProgressSnapshot, type ProgressStage } from '@/features/analysis-progress';
import { createAppError } from '@/types/errors';

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
 * 默认进度状态配置
 * 
 * 阶段命名与 AnalysisPhase 保持一致
 */
const DEFAULT_PROGRESS_STAGES: ProgressStage[] = [
  { 
    name: 'prepare', 
    label: '准备输入', 
    events: [{ type: 'prepare', label: '任务开始' }], 
    weight: 1 
  },
  { 
    name: 'fetch-template', 
    label: '获取模板', 
    events: [{ type: 'fetch-template', label: '同步分析配置' }], 
    weight: 1 
  },
  { 
    name: 'build-prompt', 
    label: '构建提示词', 
    events: [{ type: 'build-prompt', label: '拼接请求参数' }], 
    weight: 1 
  },
  {
    name: 'request-model',
    label: 'AI分析中...',
    events: [
      { type: 'request-model', weight: 1, label: '上传请求' },
      { type: 'first-token', weight: 1, label: '开始接收响应' },
      { type: 'think-start', weight: 1, label: '正在思索...' },
      { type: 'content-start', weight: 6, label: '正在起草报告...' },
    ],
    weight: 8,
  },
  { 
    name: 'extract-json', 
    label: '提取数据', 
    events: [{ type: 'extract-json', label: '解析响应内容' }], 
    weight: 1 
  },
  { 
    name: 'repair-json', 
    label: '修复数据', 
    events: [{ type: 'repair-json', label: '修复格式异常' }], 
    weight: 2 
  },
  { 
    name: 'normalize', 
    label: '生成报告', 
    events: [{ type: 'normalize', label: '提交报告' }], 
    weight: 1 
  },
];

/**
 * PageContext 值类型
 */
export type PageContextValue = {
  /** 当前模块配置 */
  moduleConfig: ModuleConfig;

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
  moduleConfig: ModuleConfig;
  currentModelConfig: ModelConfig | null;
  onRequireModelConfig?: () => void;
};

// 提示词模板服务实例
const templateService: PromptTemplateService = new ApiAnalysisService();

export function PageProvider({
  children,
  moduleConfig,
  currentModelConfig,
  onRequireModelConfig,
}: PageProviderProps) {
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

  // 保存最后一次分析参数，用于重试
  const [lastAnalysisParams, setLastAnalysisParams] = useState<AnalysisParams | null>(null);

  // 进度快照状态
  const [progressSnapshot, setProgressSnapshot] = useState<ProgressSnapshot>({
    progress: 0,
    currentStage: null,
    currentLabel: '',
    status: 'idle',
  });

  // ProgressController 实例
  const progressControllerRef = useRef<ProgressController | null>(null);
  if (!progressControllerRef.current) {
    progressControllerRef.current = new ProgressController();
  }
  const progressController = progressControllerRef.current;

  // 更新单个控制项选择
  const updateControlSelection = useCallback((controlId: string, value: string) => {
    setControlSelections(prev => ({
      ...prev,
      [controlId]: value,
    }));
  }, []);

  // 开始分析
  const startAnalysis = useCallback(async (params: AnalysisParams): Promise<AnalysisResult | null> => {
    // 检查模型配置
    if (!currentModelConfig) {
      onRequireModelConfig?.();
      return null;
    }

    // 保存参数用于重试
    setLastAnalysisParams(params);

    // 重置进度控制器并注册状态
    progressController.reset();
    progressController.registerStages(DEFAULT_PROGRESS_STAGES);

    // 订阅进度变化
    const unsubscribe = progressController.subscribe((snapshot) => {
      setProgressSnapshot(snapshot);
    });

    // 重置状态
    setAnalysisState({
      phase: 'prepare',
      status: 'running',
      canRetry: false,
    });
    setReport(null);

    try {
      // 解析序列化的输入数据
      const input = JSON.parse(params.textContent) as EvaluationInput;

      // 阶段 1: 获取动态指令
      progressController.handleEvent({ type: 'workflow-stage', stage: 'fetch-template', timestamp: Date.now() });
      setAnalysisState(prev => ({
        ...prev,
        phase: 'fetch-template',
        message: '正在同步当前分析配置',
      }));

      const compiledInstructions = await requestCompiledInstructions({
        controlSelections,
        configVersion: moduleConfig.manifest.id,
      });

      // 阶段 2: 获取提示词模板
      const template = await templateService.getTemplate({
        evaluationGoal: input.evaluationGoal,
        outputMode: moduleConfig.manifest.outputMode,
      });

      // 阶段 3: 构建请求消息
      progressController.handleEvent({ type: 'workflow-stage', stage: 'build-prompt', timestamp: Date.now() });
      setAnalysisState(prev => ({
        ...prev,
        phase: 'build-prompt',
        message: '正在构建请求',
      }));

      const { messages, maxTokens } = buildAnalysisMessages({
        input,
        template,
        instructionText: compiledInstructions.instructionText,
        containers: moduleConfig.manifest.containers,
      });

      // 阶段 4: 调用模型
      progressController.handleEvent({ type: 'workflow-stage', stage: 'request-model', timestamp: Date.now() });
      setAnalysisState(prev => ({
        ...prev,
        phase: 'request-model',
        message: '模型正在生成分析结果',
      }));

      const result = await modelClient.call({
        baseUrl: currentModelConfig.baseUrl,
        apiKey: currentModelConfig.apiKey,
        model: currentModelConfig.selectedModel,
        messages,
        temperature: template.recommendedParameters.temperature,
        maxTokens,
        events: progressController.createEventHandlers(),
      });

      // 阶段 5: 解析响应
      progressController.handleEvent({ type: 'workflow-stage', stage: 'extract-json', timestamp: Date.now() });
      setAnalysisState(prev => ({
        ...prev,
        phase: 'extract-json',
        message: '正在解析响应',
      }));

      const parsed = parseModelResponse(result.content);
      
      if (!parsed.success) {
        throw createAppError({
          code: 'provider_response_invalid',
          message: '模型返回的内容无法解析为有效的 JSON 格式，请重试。',
          retryable: true,
        });
      }

      // 取消订阅
      unsubscribe();

      // 构建结果（包含元数据）
      const analysisResult = {
        rawJson: parsed.data,
        metadata: {
          model: currentModelConfig.selectedModel,
          baseUrl: currentModelConfig.baseUrl,
          templateVersion: template.version,
          scoringPolicyVersion: template.policyMeta.scoringPolicyVersion,
          conclusionPolicyVersion: template.policyMeta.conclusionPolicyVersion,
          evaluationGoal: input.evaluationGoal,
        },
      };

      // 成功完成
      progressController.handleEvent({ type: 'workflow-stage', stage: 'normalize', timestamp: Date.now() });
      setReport(analysisResult);
      setAnalysisState({
        phase: 'normalize',
        status: 'idle',
        canRetry: false,
      });

      return analysisResult;
    } catch (error) {
      // 取消订阅
      unsubscribe();
      
      const errorMessage = error instanceof Error ? error.message : '分析失败';
      
      // 设置错误状态到进度控制器
      progressController.setError(errorMessage);
      
      // 弹出错误提示
      showError(errorMessage, 6000);
      
      setAnalysisState(prev => ({
        ...prev,
        status: 'failed',
        message: errorMessage,
        canRetry: true,
      }));
      return null;
    }
  }, [currentModelConfig, controlSelections, moduleConfig, onRequireModelConfig, progressController]);

  // 重试分析
  const retryAnalysis = useCallback(async (): Promise<AnalysisResult | null> => {
    if (!lastAnalysisParams) {
      return null;
    }
    return startAnalysis(lastAnalysisParams);
  }, [lastAnalysisParams, startAnalysis]);

  // 重置分析状态
  const resetAnalysis = useCallback(() => {
    setAnalysisState({
      phase: 'prepare',
      status: 'idle',
      canRetry: false,
    });
    setReport(null);
    setLastAnalysisParams(null);
    progressController.reset();
    setProgressSnapshot({
      progress: 0,
      currentStage: null,
      currentLabel: '',
      status: 'idle',
    });
  }, [progressController]);

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
    progressSnapshot,
    currentModelConfig,
  ]);

  return (
    <PageContext.Provider value={value}>
      {children}
    </PageContext.Provider>
  );
}
