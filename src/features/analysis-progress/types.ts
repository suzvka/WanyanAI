/**
 * 进度控制器类型定义
 */

/** 可监听的事件类型 */
export type ProgressEventType = 
  // 工作流阶段事件（与 AnalysisPhase 对应）
  | 'prepare'
  | 'fetch-template'
  | 'build-prompt'
  | 'request-model'
  | 'extract-json'
  | 'repair-json'
  | 'normalize'
  | 'complete'
  // 流式响应事件
  | 'first-token'
  | 'think-start'
  | 'content-start';

/** 进度状态定义 */
export interface ProgressStage {
  /** 状态名称（唯一标识） */
  name: string;
  /** 状态标签（用于显示） */
  label: string;
  /** 监听的事件列表（顺序即执行顺序）
   * 事件可以是简单的 `ProgressEventType` 字符串，也可以是对象 `{ type, weight? }`
   * weight 默认为 1
   */
  events: (ProgressEventType | { type: ProgressEventType; weight?: number; label?: string })[];
  /** 影响因子（用于计算进度占比，默认为 1） */
  weight?: number;
}

/** 进度整体状态 */
export type ProgressStatus = 'idle' | 'running' | 'completed' | 'error';

/** 进度快照（供外部渲染使用） */
export interface ProgressSnapshot {
  /** 当前进度百分比 (0-100，整数) */
  progress: number;
  /** 当前状态名称 */
  currentStage: string | null;
  /** 当前状态标签 */
  currentLabel: string;
  /** 当前事件级别标签（优先显示，若存在） */
  currentEventLabel?: string;
  /** 整体状态 */
  status: ProgressStatus;
  /** 错误信息（仅 status='error' 时） */
  errorMessage?: string;
}

/** 进度变化监听器 */
export type ProgressListener = (snapshot: ProgressSnapshot) => void;
