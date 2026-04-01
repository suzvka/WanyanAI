/**
 * 流式响应事件类型
 * 
 * 分为两类：
 * 1. 工作流阶段事件：表示分析流程中的各个阶段
 * 2. 流式响应事件：表示模型响应过程中的关键节点
 * 
 * 所有事件完全独立，不存在则不触发
 */

// ============ 工作流阶段事件 ============

/** 工作流阶段类型 */
export type WorkflowStage = 
  | 'prepare'         // 准备阶段：整理输入数据
  | 'fetch-template'  // 获取提示词模板
  | 'build-prompt'    // 构建最终提示词
  | 'request-model'   // 请求模型生成
  | 'extract-json'    // 提取 JSON 数据
  | 'repair-json'     // 修复 JSON 格式
  | 'normalize';      // 标准化报告

/** 工作流阶段事件 */
export type WorkflowStageEvent = {
  type: 'workflow-stage';
  stage: WorkflowStage;
  timestamp: number;
  message?: string;
  data?: Record<string, unknown>;
};

// ============ 流式响应事件 ============

/** 流式响应事件类型 */
export type StreamEventType = 
  | 'first-token'    // 收到第一个有效 token
  | 'think-start'    // 检测到思考块开始
  | 'content-start'; // 检测到正文开始

/** 流式响应事件 */
export type StreamResponseEvent = {
  type: StreamEventType;
  timestamp: number;
  data?: Record<string, unknown>;
};

// ============ 统一事件类型 ============

/** 分析事件（联合类型） */
export type AnalysisEvent = WorkflowStageEvent | StreamResponseEvent;

/** 事件回调函数类型 */
export type AnalysisEventCallback = (event: AnalysisEvent) => void;

/**
 * 分析事件订阅配置
 * 
 * 每个事件都是可选的，不订阅的事件不会触发任何回调
 */
export interface AnalysisEventHandlers {
  /** 工作流阶段变更时触发 */
  onWorkflowStage?: AnalysisEventCallback;
  /** 第一个 token 到达时触发 */
  onFirstToken?: AnalysisEventCallback;
  /** 检测到思考块开始时触发 */
  onThinkStart?: AnalysisEventCallback;
  /** 检测到正文开始时触发 */
  onContentStart?: AnalysisEventCallback;
}

/**
 * 思考块检测模式配置
 * 
 * 用于识别不同模型的思考过程输出格式
 */
export interface ThinkPatternConfig {
  /** 思考块开始标记 */
  start?: string[];
  /** 思考块结束标记 */
  end?: string[];
}

// ============ 兼容旧类型（过渡期使用） ============

/** @deprecated 使用 AnalysisEvent 代替 */
export type StreamEvent = StreamResponseEvent;

/** @deprecated 使用 AnalysisEventHandlers 代替 */
export type StreamEventHandlers = AnalysisEventHandlers;
