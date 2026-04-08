'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { evaluationGoalLabels } from '@/config/evaluationDimensions';
import { ProgressController } from '@/features/analysis-progress';
import { reportHistoryStore } from '@/features/report-history';
import { showSuccessWithAction } from '@/lib/alert';
import type {
  AnalysisTaskRecord,
  CreateAnalysisTaskInput,
  RuntimeAnalysisTask,
  TaskSubscriptionListener,
} from '@/features/analysis-tasks/types';
import { createSchedulerKey } from '@/features/analysis-tasks/createSchedulerKey';
import { DEFAULT_PROGRESS_STAGES, runAnalysisTask } from '@/features/analysis-tasks/runAnalysisTask';

function generateTaskId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildTaskTitle(input: CreateAnalysisTaskInput): string {
  const goalLabel = evaluationGoalLabels[input.input.evaluationGoal as keyof typeof evaluationGoalLabels] ?? input.input.evaluationGoal;
  return `${goalLabel}概览`;
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
  const runtimeTasksRef = useRef(new Map<string, RuntimeAnalysisTask>());
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
    if (runningTasksRef.current.has(schedulerKey)) {
      return;
    }

    const queue = schedulerQueuesRef.current.get(schedulerKey) ?? [];
    const nextTaskId = queue.shift();
    schedulerQueuesRef.current.set(schedulerKey, queue);

    if (!nextTaskId) {
      return;
    }

    const runtimeTask = runtimeTasksRef.current.get(nextTaskId);
    if (!runtimeTask) {
      processQueue(schedulerKey);
      return;
    }

    const progressController = new ProgressController();
    progressController.registerStages(DEFAULT_PROGRESS_STAGES);
    runningTasksRef.current.set(schedulerKey, nextTaskId);

    console.log('[AnalysisTaskProvider] Starting task execution:', { taskId: nextTaskId });

    reportHistoryStore.updateTaskRecord(nextTaskId, {
      status: 'running',
      progressSnapshot: progressController.getSnapshot(),
      taskMeta: {
        phase: 'prepare',
        message: '任务启动中...',
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
          phase,
          message,
        },
      });
      notifyTaskListeners(nextTaskId);
    });

    void runAnalysisTask(runtimeTask, progressController)
      .then((report) => {
        console.log('[AnalysisTaskProvider] Task completed successfully:', { taskId: nextTaskId });
        const completedRecord = reportHistoryStore.completeTask(nextTaskId, report);
        showSuccessWithAction(`分析已完成：${completedRecord.title}`, {
          duration: 5000,
        });
        runtimeTasksRef.current.delete(nextTaskId);
      })
      .catch((error) => {
        console.error('[AnalysisTaskProvider] Task failed:', { taskId: nextTaskId, error });
        const message = error instanceof Error ? error.message : '分析失败';
        progressController.setError(message);
        reportHistoryStore.failTask(nextTaskId, message);
      })
      .finally(() => {
        console.log('[AnalysisTaskProvider] Task cleanup:', { taskId: nextTaskId });
        unsubscribe();
        runningTasksRef.current.delete(schedulerKey);
        notifyTaskListeners(nextTaskId);
        processQueue(schedulerKey);
      });
  }, [notifyTaskListeners]);

  const createTask = useCallback(async (input: CreateAnalysisTaskInput): Promise<string | null> => {
    const taskId = generateTaskId();
    const createdAt = new Date().toISOString();
    const schedulerKey = createSchedulerKey(input.modelConfig);

    console.log('[AnalysisTaskProvider] Creating task:', {
      taskId,
      schedulerKey,
      moduleId: input.moduleConfig.manifest.slug,
      model: input.modelConfig.selectedModel,
    });

    const runtimeTask: RuntimeAnalysisTask = {
      id: taskId,
      schedulerKey,
      moduleConfig: input.moduleConfig,
      modelConfig: input.modelConfig,
      controlSelections: input.controlSelections,
      params: input.params,
      input: input.input,
      createdAt,
    };

    runtimeTasksRef.current.set(taskId, runtimeTask);

    console.log('[AnalysisTaskProvider] Creating task record in store');
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

    console.log('[AnalysisTaskProvider] Task created and queued:', { taskId, queueLength: queue.length });
    return taskId;
  }, [notifyTaskListeners, processQueue]);

  const retryTask = useCallback(async (taskId: string): Promise<string | null> => {
    const runtimeTask = runtimeTasksRef.current.get(taskId);
    if (!runtimeTask) {
      return null;
    }

    return createTask({
      moduleConfig: runtimeTask.moduleConfig,
      modelConfig: runtimeTask.modelConfig,
      controlSelections: runtimeTask.controlSelections,
      params: runtimeTask.params,
      input: runtimeTask.input,
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
  const canRetryTask = useCallback((taskId: string) => runtimeTasksRef.current.has(taskId), []);

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
