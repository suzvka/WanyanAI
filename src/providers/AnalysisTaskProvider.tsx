'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { ProgressController } from '@/features/analysis-progress';
import { reportHistoryStore } from '@/features/report-history';
import { showSuccessWithAction } from '@/lib/alert';
import { createLogger } from '@/lib/api-station/logger';
import type {
  AnalysisTaskRecord,
  CreateAnalysisTaskInput,
  TaskSubscriptionListener,
} from '@/features/analysis-tasks/types';
import { runClientAnalysis, DEFAULT_PROGRESS_STAGES } from '@/features/analysis-tasks/clientAnalysisRunner';
import { runAgent } from '@/features/agent/AgentRunner';
import type { AgentProgressSnapshot } from '@/features/agent/types';

const logger = createLogger('AnalysisTaskProvider');

function generateTaskId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildTaskTitle(input: CreateAnalysisTaskInput): string {
  return `${input.moduleName}概览`;
}

/**
 * 生成调度 Key（不包含敏感信息）
 *
 * 只使用 baseUrl 和 model，不包含 apiKey。
 */
function createSchedulerKey(baseUrl: string, model: string): string {
  // 简单哈希函数
  let hash = 2166136261;
  const value = `${baseUrl}::${model}`;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `task-${(hash >>> 0).toString(16)}`;
}

type AnalysisTaskContextValue = {
  createTask: (input: CreateAnalysisTaskInput) => Promise<string | null>;
  getTask: (taskId: string) => AnalysisTaskRecord | null;
  subscribeTask: (taskId: string, listener: TaskSubscriptionListener) => () => void;
  retryTask: (taskId: string) => Promise<string | null>;
  canRetryTask: (taskId: string) => boolean;
};

const AnalysisTaskContext = createContext<AnalysisTaskContextValue | null>(null);

export function AnalysisTaskProvider({ children }: { children: ReactNode }) {
  // 存储任务输入（不包含敏感信息的引用）
  const taskInputsRef = useRef(new Map<string, CreateAnalysisTaskInput>());
  const schedulerQueuesRef = useRef(new Map<string, string[]>());
  const runningTasksRef = useRef(new Map<string, string>());
  const taskListenersRef = useRef(new Map<string, Set<TaskSubscriptionListener>>());

  const notifyTaskListeners = useCallback((taskId: string) => {
    const listeners = taskListenersRef.current.get(taskId);
    if (!listeners || listeners.size === 0) {
      return;
    }

    const record = reportHistoryStore.getRecord(taskId);
    listeners.forEach((listener: TaskSubscriptionListener) => listener(record));
  }, []);

  const processQueue = useCallback((schedulerKey: string) => {
    // 队列处理以内部函数递归，避免 useCallback 自引用（React Compiler 规则）
    const run = () => {
    if (runningTasksRef.current.has(schedulerKey)) {
      return;
    }

    const queue = schedulerQueuesRef.current.get(schedulerKey) ?? [];
    const nextTaskId = queue.shift();
    schedulerQueuesRef.current.set(schedulerKey, queue);

    if (!nextTaskId) {
      return;
    }

    const taskInput = taskInputsRef.current.get(nextTaskId);
    if (!taskInput) {
      run();
      return;
    }

    const progressController = new ProgressController();
    progressController.registerStages(DEFAULT_PROGRESS_STAGES);
    runningTasksRef.current.set(schedulerKey, nextTaskId);

    logger.info('Starting task execution', { taskId: nextTaskId });

    reportHistoryStore.updateTaskRecord(nextTaskId, {
      status: 'running',
      progressSnapshot: progressController.getSnapshot(),
      taskMeta: {
        phase: 'prepare',
        message: '任务启动中...',
        model: taskInput.modelConfig.selectedModel,
        baseUrl: taskInput.modelConfig.baseUrl,
        schedulerKey,
      },
    });
    notifyTaskListeners(nextTaskId);

    const unsubscribe = progressController.subscribe((snapshot) => {
      const currentRecord = reportHistoryStore.getRecord(nextTaskId);
      if (!currentRecord) {
        return;
      }

      const phase = (snapshot.currentStage as AnalysisTaskRecord['taskMeta']['phase'] | null) ?? currentRecord.taskMeta.phase;
      const message = snapshot.currentEventLabel || snapshot.currentLabel || currentRecord.taskMeta.message;

      reportHistoryStore.updateTaskRecord(nextTaskId, {
        status: 'running',
        progressSnapshot: snapshot,
        taskMeta: {
          ...currentRecord.taskMeta,
          phase,
          message,
        },
      });
      notifyTaskListeners(nextTaskId);
    });

    // Pipeline 模式由 agent.steps 配置决定
    const shouldUsePipeline = (taskInput.moduleConfig.manifest.agent?.steps?.length ?? 0) > 0;

    if (shouldUsePipeline) {
      // === Pipeline 编排模式 ===
      const agentPipeline = taskInput.moduleConfig.manifest.agent!;
      logger.info('Starting pipeline task', { taskId: nextTaskId, pipeline: agentPipeline.steps.map(s => s.outputMode) });

      const agentProgressHandler = (snapshot: AgentProgressSnapshot) => {
        const label = snapshot.phase === 'agent-final'
          ? `最终步骤：${snapshot.stepLabel}`
          : `步骤 ${snapshot.stepIndex + 1}/${snapshot.totalSteps}：${snapshot.stepLabel}`;

        progressController.handleEvent({
          type: 'workflow-stage',
          stage: 'request-model',
          timestamp: Date.now(),
        });

        const currentRecord = reportHistoryStore.getRecord(nextTaskId);
        if (currentRecord) {
          reportHistoryStore.updateTaskRecord(nextTaskId, {
            status: 'running',
            progressSnapshot: {
              ...progressController.getSnapshot(),
              currentLabel: label,
              currentEventLabel: snapshot.phase === 'agent-final' ? '正在生成最终报告...' : '正在分析中...',
            },
            taskMeta: {
              ...currentRecord.taskMeta,
              phase: 'request-model',
              message: label,
            },
          });
          notifyTaskListeners(nextTaskId);
        }
      };

      void runAgent(
        {
          taskId: nextTaskId,
          moduleConfig: taskInput.moduleConfig,
          modelConfig: taskInput.modelConfig,
          controlSelections: taskInput.controlSelections,
          input: taskInput.input,
          pipeline: agentPipeline,
        },
        agentProgressHandler,
      )
        .then((result) => {
          if (result.success && result.report) {
            logger.info('Pipeline task completed', { taskId: nextTaskId });
            const completedRecord = reportHistoryStore.completeTask(nextTaskId, result.report);
            showSuccessWithAction(`分析已完成：${completedRecord.title}`, { duration: 5000 });
          } else {
            logger.error('Pipeline task failed', result.error, { taskId: nextTaskId });
            progressController.setError(result.error || '分析失败');
            reportHistoryStore.failTask(nextTaskId, result.error || '分析失败');
          }
          taskInputsRef.current.delete(nextTaskId);
        })
        .catch((error) => {
          logger.error('Pipeline task failed', error, { taskId: nextTaskId });
          const message = error instanceof Error ? error.message : '分析失败';
          progressController.setError(message);
          reportHistoryStore.failTask(nextTaskId, message);
          taskInputsRef.current.delete(nextTaskId);
        })
        .finally(() => {
          logger.debug('Pipeline task cleanup', { taskId: nextTaskId });
          unsubscribe();
          runningTasksRef.current.delete(schedulerKey);
          notifyTaskListeners(nextTaskId);
          run();
        });
    } else {
      // === 单步分析模式 ===
      void runClientAnalysis(
        {
          taskId: nextTaskId,
          moduleConfig: taskInput.moduleConfig,
          modelConfig: taskInput.modelConfig,
          controlSelections: taskInput.controlSelections,
          input: taskInput.input,
        },
        progressController
      )
        .then((result) => {
          if (result.success && result.report) {
            logger.info('Task completed successfully', { taskId: nextTaskId });
            const completedRecord = reportHistoryStore.completeTask(nextTaskId, result.report);
            showSuccessWithAction(`分析已完成：${completedRecord.title}`, {
              duration: 5000,
            });
          } else {
            logger.error('Task failed', result.error, { taskId: nextTaskId });
            progressController.setError(result.error || '分析失败');
            reportHistoryStore.failTask(nextTaskId, result.error || '分析失败');
          }
          taskInputsRef.current.delete(nextTaskId);
        })
        .catch((error) => {
          logger.error('Task failed', error, { taskId: nextTaskId });
          const message = error instanceof Error ? error.message : '分析失败';
          progressController.setError(message);
          reportHistoryStore.failTask(nextTaskId, message);
          taskInputsRef.current.delete(nextTaskId);
        })
        .finally(() => {
          logger.debug('Task cleanup', { taskId: nextTaskId });
          unsubscribe();
          runningTasksRef.current.delete(schedulerKey);
          notifyTaskListeners(nextTaskId);
          run();
        });
    }
    };
    run();
  }, [notifyTaskListeners]);

  const createTask = useCallback(async (input: CreateAnalysisTaskInput): Promise<string | null> => {
    const taskId = generateTaskId();
    const createdAt = new Date().toISOString();
    // 不再包含 apiKey
    const schedulerKey = createSchedulerKey(input.modelConfig.baseUrl, input.modelConfig.selectedModel);

    logger.debug('Creating task', {
      taskId,
      schedulerKey,
      moduleId: input.moduleConfig.manifest.slug,
      model: input.modelConfig.selectedModel,
    });

    // 存储任务输入（在客户端内存中，不发送给服务端）
    taskInputsRef.current.set(taskId, input);

    logger.debug('Creating task record in store');
    reportHistoryStore.createTaskRecord({
      id: taskId,
      title: buildTaskTitle(input),
      createdAt,
      moduleId: input.moduleConfig.manifest.slug,
      outputMode: input.moduleConfig.manifest.outputMode,
      model: input.modelConfig.selectedModel,
      baseUrl: input.modelConfig.baseUrl,
      schedulerKey,
    });

    const queue = schedulerQueuesRef.current.get(schedulerKey) ?? [];
    queue.push(taskId);
    schedulerQueuesRef.current.set(schedulerKey, queue);
    notifyTaskListeners(taskId);
    processQueue(schedulerKey);

    logger.info('Task created and queued', { taskId, queueLength: queue.length });
    return taskId;
  }, [notifyTaskListeners, processQueue]);

  const retryTask = useCallback(async (taskId: string): Promise<string | null> => {
    const taskInput = taskInputsRef.current.get(taskId);
    if (!taskInput) {
      return null;
    }

    return createTask({
      moduleConfig: taskInput.moduleConfig,
      modelConfig: taskInput.modelConfig,
      controlSelections: taskInput.controlSelections,
      params: taskInput.params,
      input: taskInput.input,
      moduleName: taskInput.moduleName,
    });
  }, [createTask]);

  const subscribeTask = useCallback((taskId: string, listener: TaskSubscriptionListener) => {
    const listeners = taskListenersRef.current.get(taskId) ?? new Set<TaskSubscriptionListener>();
    listeners.add(listener);
    taskListenersRef.current.set(taskId, listeners);
    listener(reportHistoryStore.getRecord(taskId));

    return () => {
      const currentListeners = taskListenersRef.current.get(taskId);
      if (!currentListeners) {
        return;
      }

      currentListeners.delete(listener);
      if (currentListeners.size === 0) {
        taskListenersRef.current.delete(taskId);
      }
    };
  }, []);

  const getTask = useCallback((taskId: string) => reportHistoryStore.getRecord(taskId), []);
  const canRetryTask = useCallback((taskId: string) => taskInputsRef.current.has(taskId), []);

  useEffect(() => {
    reportHistoryStore.markInterruptedTasksAsFailed('任务因页面刷新或会话中断而结束。');
  }, []);

  const value = useMemo<AnalysisTaskContextValue>(() => ({
    createTask,
    getTask,
    subscribeTask,
    retryTask,
    canRetryTask,
  }), [canRetryTask, createTask, getTask, retryTask, subscribeTask]);

  return <AnalysisTaskContext.Provider value={value}>{children}</AnalysisTaskContext.Provider>;
}

export function useAnalysisTasks(): AnalysisTaskContextValue {
  const context = useContext(AnalysisTaskContext);
  if (!context) {
    throw new Error('useAnalysisTasks must be used within an AnalysisTaskProvider');
  }

  return context;
}
