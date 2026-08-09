import type { AnalysisEvent } from '@/types/streamEvents';
import type {
  ProgressEventType,
  ProgressStage,
  ProgressStatus,
  ProgressSnapshot,
  ProgressListener,
} from './types';

/**
 * 状态元数据（预计算）
 */
type StageMeta = {
  weight: number;
  startProgress: number; // 该状态起始进度百分比 (0-100)
  endProgress: number;   // 该状态结束进度百分比 (0-100)
  eventCount: number;
  // 每个事件的权重（与 ProgressStage.events 对应）
  eventWeights: number[];
  // 事件权重总和
  eventWeightsSum: number;
  // 事件级别的显示标签（与 ProgressStage.events 对应）
  eventLabels: (string | null)[];
};

/**
 * 进度控制器
 * 
 * 负责：
 * 1. 状态注册与管理（支持权重）
 * 2. 事件匹配与进度计算（基于权重的线性映射）
 * 3. 状态快照生成
 */
export class ProgressController {
  // 已注册的状态列表
  private stages: ProgressStage[] = [];
  
  // 状态元数据（预计算权重映射）
  private stageMetas: StageMeta[] = [];
  
  // 每个阶段的事件类型集合（独立存储，避免同一事件只能映射到一个阶段）
  private stageEventTypes: Set<ProgressEventType>[] = [];
  
  // 总权重
  private totalWeight = 0;
  
  // 当前进度索引（当前状态索引 + 状态内事件索引）
  private currentStageIndex = -1;
  private currentEventIndexInStage = -1;
  
  // 记录每个状态内哪些事件已触发（用于选择正确的标签）
  // triggeredEvents[stageIndex] = Set<eventIndexInStage>
  private triggeredEvents: Map<number, Set<number>> = new Map();
  
  // 辅助方法：获取 triggeredEvents 的可序列化内容
  private triggeredEntries(): [number, number[]][] {
    const entries: [number, number[]][] = [];
    this.triggeredEvents.forEach((set, key) => {
      entries.push([key, Array.from(set)]);
    });
    return entries;
  }

  // 整体状态
  private status: ProgressStatus = 'idle';
  
  // 错误信息
  private errorMessage: string | undefined;
  
  // 监听器列表
  private listeners: Set<ProgressListener> = new Set();

  /**
   * 批量注册状态
   * @param stages 状态列表（顺序即执行顺序）
   */
  registerStages(stages: ProgressStage[]): void {
    this.stages = stages;
    this.stageMetas = [];
    this.stageEventTypes = [];
    this.totalWeight = 0;
    
    // 计算总权重
    for (const stage of stages) {
      this.totalWeight += stage.weight ?? 1;
    }
    
    // 预计算每个状态的元数据
    let cumulativeWeight = 0;
    for (const stage of stages) {
      const weight = stage.weight ?? 1;
      const startProgress = (cumulativeWeight / this.totalWeight) * 100;
      const endProgress = ((cumulativeWeight + weight) / this.totalWeight) * 100;
      // 处理阶段内事件权重（事件可以是 string 或 { type, weight? }）
      const eventWeights: number[] = [];
      const eventLabels: (string | null)[] = [];
      for (const ev of stage.events) {
        if (typeof ev === 'string') {
          eventWeights.push(1);
          eventLabels.push(null);
        } else if (ev && typeof ev === 'object' && 'weight' in ev) {
          eventWeights.push((ev.weight ?? 1));
          eventLabels.push(ev.label ?? null);
        } else {
          eventWeights.push(1);
          eventLabels.push(null);
        }
      }
      const eventWeightsSum = eventWeights.reduce((s, v) => s + v, 0);

      this.stageMetas.push({
        weight,
        startProgress,
        endProgress,
        eventCount: stage.events.length,
        eventWeights,
        eventWeightsSum,
        eventLabels,
      });
      
      cumulativeWeight += weight;
    }
    
    // 构建每个阶段的事件集合（每个阶段独立存储，支持同一事件出现在多个阶段）
    for (const stage of stages) {
      const eventTypes = new Set<ProgressEventType>();
      
      for (const rawEvent of stage.events) {
        const eventType = typeof rawEvent === 'string' 
          ? rawEvent 
          : (rawEvent as { type: ProgressEventType }).type;
        eventTypes.add(eventType);
      }
      
      this.stageEventTypes.push(eventTypes);
    }
  }

  /**
   * 从 AnalysisEvent 提取 ProgressEventType
   */
  private getEventType(event: AnalysisEvent): ProgressEventType | null {
    if (event.type === 'workflow-stage') {
      return event.stage as ProgressEventType;
    }
    // 流式响应事件
    if (event.type === 'first-token' || event.type === 'think-start' || event.type === 'content-start') {
      return event.type;
    }
    return null;
  }

  /**
   * 处理事件
   * 自动匹配状态并更新进度
   */
  handleEvent(event: AnalysisEvent): void {
    const eventType = this.getEventType(event);
    if (!eventType) return;

    // 从当前阶段向后查找匹配的阶段
    const startSearchIndex = Math.max(0, this.currentStageIndex);
    
    for (let stageIndex = startSearchIndex; stageIndex < this.stages.length; stageIndex++) {
      const eventTypes = this.stageEventTypes[stageIndex];
      
      if (!eventTypes?.has(eventType)) continue;
      
      // 找到该事件在此阶段中的索引
      const stage = this.stages[stageIndex];
      const eventIndexInStage = stage.events.findIndex(rawEvent => {
        const type = typeof rawEvent === 'string' ? rawEvent : (rawEvent as { type: ProgressEventType }).type;
        return type === eventType;
      });
      
      if (eventIndexInStage === -1) continue;

      // 检查是否应该更新（同阶段内事件索引必须递增）
      const shouldUpdate = 
        stageIndex > this.currentStageIndex ||
        (stageIndex === this.currentStageIndex && eventIndexInStage > this.currentEventIndexInStage);

      if (shouldUpdate) {
        this.currentStageIndex = stageIndex;
        this.currentEventIndexInStage = eventIndexInStage;
        
        // 记录已触发的事件
        if (!this.triggeredEvents.has(stageIndex)) {
          this.triggeredEvents.set(stageIndex, new Set());
        }
        this.triggeredEvents.get(stageIndex)!.add(eventIndexInStage);
        
        // 首次收到事件时，状态变为 running
        if (this.status === 'idle') {
          this.status = 'running';
        }
        
        // 判断是否完成（最后一个状态的最后一个事件）
        const lastStageIndex = this.stages.length - 1;
        const lastStage = this.stages[lastStageIndex];
        const lastEventIndex = lastStage.events.length - 1;
        
        if (this.currentStageIndex === lastStageIndex && 
            this.currentEventIndexInStage === lastEventIndex) {
          this.status = 'completed';
        }
        
        this.notifyListeners();
      }
      return; // 找到匹配后就返回
    }
  }

  /**
   * 创建事件处理器
   * 返回的对象可直接传给 generateReport({ events: ... })
   */
  createEventHandlers(): {
    onWorkflowStage: (event: AnalysisEvent) => void;
    onFirstToken: (event: AnalysisEvent) => void;
    onThinkStart: (event: AnalysisEvent) => void;
    onContentStart: (event: AnalysisEvent) => void;
  } {
    return {
      onWorkflowStage: (event: AnalysisEvent) => {
        this.handleEvent(event);
      },
      onFirstToken: (event: AnalysisEvent) => {
        this.handleEvent(event);
      },
      onThinkStart: (event: AnalysisEvent) => {
        this.handleEvent(event);
      },
      onContentStart: (event: AnalysisEvent) => {
        this.handleEvent(event);
      },
    };
  }

  /**
   * 重置进度
   */
  reset(): void {
    this.currentStageIndex = -1;
    this.currentEventIndexInStage = -1;
    this.triggeredEvents.clear();
    this.status = 'idle';
    this.errorMessage = undefined;
    this.notifyListeners();
  }

  /**
   * 设置错误状态
   */
  setError(message: string): void {
    this.status = 'error';
    this.errorMessage = message;
    this.notifyListeners();
  }

  /**
   * 获取当前状态快照
   */
  getSnapshot(): ProgressSnapshot {
    const progress = this.calculateProgress();
    const currentStage = this.currentStageIndex >= 0 
      ? this.stages[this.currentStageIndex] 
      : null;
    
    // 基于已触发的最高索引事件选择标签
    let currentEventLabel: string | undefined = undefined;
    if (this.currentStageIndex >= 0) {
      const meta = this.stageMetas[this.currentStageIndex];
      const triggeredInStage = this.triggeredEvents.get(this.currentStageIndex);
      
      if (meta && triggeredInStage && triggeredInStage.size > 0) {
        // 找到已触发事件中的最高索引
        const maxTriggeredIndex = Math.max(...triggeredInStage);
        if (meta.eventLabels && meta.eventLabels[maxTriggeredIndex]) {
          currentEventLabel = meta.eventLabels[maxTriggeredIndex] ?? undefined;
        }
      }
    }

    return {
      progress,
      currentStage: currentStage?.name ?? null,
      currentLabel: currentStage?.label ?? '',
      currentEventLabel,
      status: this.status,
      errorMessage: this.errorMessage,
    };
  }

  /**
   * 订阅状态变化
   * @returns 取消订阅函数
   */
  subscribe(listener: ProgressListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 计算当前进度百分比（基于权重的线性映射）
   * 返回整数，直接截断小数部分
   */
  private calculateProgress(): number {
    if (this.totalWeight === 0) return 0;
    if (this.currentStageIndex < 0) return 0;
    
    const meta = this.stageMetas[this.currentStageIndex];
    if (!meta) return 0;
    
    // 如果状态内没有事件，直接返回该状态的结束进度
    if (meta.eventCount === 0) {
      return Math.floor(meta.endProgress);
    }
    // 状态内事件按权重分配该状态的进度空间
    // 已完成事件的权重之和 / 总权重 决定在该状态区间的比例
    const stageProgressRange = meta.endProgress - meta.startProgress;

    // 计算已完成的事件权重（当前事件及之前的事件都算完成）
    let completedWeight = 0;
    for (let i = 0; i <= this.currentEventIndexInStage && i < meta.eventWeights.length; i++) {
      completedWeight += meta.eventWeights[i];
    }

    const ratio = meta.eventWeightsSum > 0 ? (completedWeight / meta.eventWeightsSum) : 0;
    const eventProgress = stageProgressRange * ratio;

    return Math.floor(Math.min(100, meta.startProgress + eventProgress));
  }

  /**
   * 通知所有监听器
   */
  private notifyListeners(): void {
    const snapshot = this.getSnapshot();
    this.listeners.forEach(listener => listener(snapshot));
  }
}
