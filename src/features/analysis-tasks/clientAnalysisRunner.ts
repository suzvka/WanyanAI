/**
 * 客户端分析执行器
 *
 * runClientAnalysis 现为 executeOutputMode（框架层统一入口）的薄封装。
 * 所有实际的 LLM 调用、MCP 工具执行、验证逻辑都在 executeOutputMode 中。
 */

import { ProgressController } from '@/features/analysis-progress';
import { executeOutputMode } from '@/features/analysis-flow/lib/executeOutputMode';
import type { ModelConfig } from '@/types/modelConfig';
import type { PageModuleConfig } from '@/types/module';
import type { ControlSelections } from '@/providers/PageContext';
import type { EvaluationInput } from '@/types/report';
import type { PersistedAnalysisReport } from '@/types/analysis';
import type { ProgressStage } from '@/features/analysis-progress';

// 客户端调试日志
const clientLog = (message: string, data?: unknown) => {
  console.log(`[clientAnalysisRunner] ${message}`, data !== undefined ? data : '');
};

/**
 * 默认进度阶段定义
 */
export const DEFAULT_PROGRESS_STAGES: ProgressStage[] = [
  {
    name: 'prepare',
    label: '准备输入',
    events: [{ type: 'prepare', label: '任务开始' }],
    weight: 1,
  },
  {
    name: 'fetch-template',
    label: '获取模板',
    events: [{ type: 'fetch-template', label: '同步分析配置' }],
    weight: 1,
  },
  {
    name: 'build-prompt',
    label: '构建提示词',
    events: [{ type: 'build-prompt', label: '拼接请求参数' }],
    weight: 1,
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
    name: 'parse-mcp',
    label: '提取工具调用',
    events: [{ type: 'parse-mcp', label: '解析工具调用' }],
    weight: 1,
  },
  {
    name: 'invoke-tool',
    label: '执行工具',
    events: [{ type: 'invoke-tool', label: '调用提交工具' }],
    weight: 1,
  },
  {
    name: 'normalize',
    label: '生成报告',
    events: [{ type: 'normalize', label: '提交报告' }],
    weight: 1,
  },
];

/**
 * 分析任务输入参数
 */
export interface ClientAnalysisInput {
  taskId: string;
  moduleConfig: PageModuleConfig;
  modelConfig: ModelConfig;
  controlSelections: ControlSelections;
  input: EvaluationInput;
}

/**
 * 分析任务结果
 */
export interface ClientAnalysisResult {
  success: boolean;
  report?: PersistedAnalysisReport;
  error?: string;
}

/**
 * 执行分析任务
 *
 * 委托给 executeOutputMode（框架层统一入口）。
 * 所有实际的 LLM 调用、MCP 工具执行、验证逻辑都在 executeOutputMode 中。
 */
export async function runClientAnalysis(
  input: ClientAnalysisInput,
  progressController: ProgressController
): Promise<ClientAnalysisResult> {
  const { taskId, moduleConfig, modelConfig, controlSelections, input: evaluationInput } = input;

  try {
    progressController.handleEvent({ type: 'workflow-stage', stage: 'prepare', timestamp: Date.now() });
    progressController.handleEvent({ type: 'workflow-stage', stage: 'fetch-template', timestamp: Date.now() });
    progressController.handleEvent({ type: 'workflow-stage', stage: 'build-prompt', timestamp: Date.now() });
    progressController.handleEvent({ type: 'workflow-stage', stage: 'request-model', timestamp: Date.now() });

    clientLog('Delegating to executeOutputMode', {
      moduleSlug: moduleConfig?.manifest?.slug,
      outputMode: moduleConfig?.manifest?.outputMode,
    });

    const result = await executeOutputMode({
      outputModeId: moduleConfig.manifest.outputMode,
      moduleConfig,
      modelConfig,
      controlSelections,
      input: evaluationInput,
      isTerminal: true,
      taskId,
    });

    if (result.success && result.report) {
      progressController.handleEvent({ type: 'workflow-stage', stage: 'normalize', timestamp: Date.now() });
      return { success: true, report: result.report };
    }

    return { success: false, error: result.error };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '分析失败';
    return { success: false, error: errorMessage };
  }
}
