export type AppFlowStep = 'input' | 'analyzing' | 'report';

/**
 * 分析工作流阶段
 *
 * 命名规则：与 ProgressStage.name 保持一致
 */
export type AnalysisPhase =
  | 'prepare'
  | 'fetch-template'
  | 'build-prompt'
  | 'request-model'
  | 'parse-mcp'
  | 'invoke-tool'
  | 'extract-json'
  | 'repair-json'
  | 'normalize';

export type AnalysisStatus = 'idle' | 'running' | 'recovering' | 'failed';
