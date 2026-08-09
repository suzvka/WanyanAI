/**
 * 分析引擎按需加载器
 *
 * 分析引擎（LangChain 编排层 + 客户端分析管线）体积较大（约 190 KB gz），
 * 且仅在用户真正开始分析时才需要，因此通过动态导入将其移出首屏 bundle。
 *
 * 注意：本文件是引擎代码进入客户端依赖图的唯一入口，
 * 任何调用方都不得再静态 import AgentRunner / clientAnalysisRunner，
 * 否则代码拆分会失效。
 */

type ClientAnalysisRunnerModule = typeof import('@/features/analysis-tasks/clientAnalysisRunner');
type AgentRunnerModule = typeof import('@/features/agent/AgentRunner');

/**
 * 分析引擎模块集合
 */
export interface AnalysisEngine {
  /** 单步分析执行器 */
  runClientAnalysis: ClientAnalysisRunnerModule['runClientAnalysis'];
  /** 默认进度阶段定义 */
  DEFAULT_PROGRESS_STAGES: ClientAnalysisRunnerModule['DEFAULT_PROGRESS_STAGES'];
  /** Pipeline 编排执行器（LangChain） */
  runAgent: AgentRunnerModule['runAgent'];
}

/** 引擎加载 Promise 缓存：复用同一加载过程，避免并发重复请求 */
let enginePromise: Promise<AnalysisEngine> | null = null;

/**
 * 加载分析引擎（带缓存，重复调用复用同一 Promise）
 *
 * 加载失败时重置缓存，保证下次调用可以重新加载。
 */
export function loadAnalysisEngine(): Promise<AnalysisEngine> {
  if (!enginePromise) {
    enginePromise = Promise.all([
      import('@/features/analysis-tasks/clientAnalysisRunner'),
      import('@/features/agent/AgentRunner'),
    ])
      .then(([runnerModule, agentModule]) => ({
        runClientAnalysis: runnerModule.runClientAnalysis,
        DEFAULT_PROGRESS_STAGES: runnerModule.DEFAULT_PROGRESS_STAGES,
        runAgent: agentModule.runAgent,
      }))
      .catch((error) => {
        enginePromise = null;
        throw error;
      });
  }
  return enginePromise;
}

/**
 * 空闲预热：提前静默下载引擎代码，可安全重复调用
 *
 * 由评估页在进入后调用，用户真正点击"开始分析"时通常已命中缓存。
 * 预热失败静默忽略（正式加载时会重试）。
 */
export function preloadAnalysisEngine(): void {
  loadAnalysisEngine().catch(() => {
    // 预热失败无需提示，loadAnalysisEngine 已重置缓存供后续重试
  });
}
