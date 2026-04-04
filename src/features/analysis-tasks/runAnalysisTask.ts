import { ProgressController, type ProgressStage } from '@/features/analysis-progress';
import { buildAnalysisMessages, parseModelResponse, requestCompiledInstructions } from '@/features/analysis-flow/lib';
import { getOutputMode } from '@/features/output-modes';
import { modelClient } from '@/services/model-client';
import { ApiAnalysisService } from '@/services/analysis/apiAnalysisService';
import { createAppError } from '@/types/errors';
import type { PersistedAnalysisReport } from '@/types/analysis';
import type { RuntimeAnalysisTask } from './types';

const templateService = new ApiAnalysisService();

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
    name: 'extract-json',
    label: '提取数据',
    events: [{ type: 'extract-json', label: '解析响应内容' }],
    weight: 1,
  },
  {
    name: 'repair-json',
    label: '修复数据',
    events: [{ type: 'repair-json', label: '修复格式异常' }],
    weight: 2,
  },
  {
    name: 'normalize',
    label: '生成报告',
    events: [{ type: 'normalize', label: '提交报告' }],
    weight: 1,
  },
];

export async function runAnalysisTask(
  task: RuntimeAnalysisTask,
  progressController: ProgressController,
): Promise<PersistedAnalysisReport> {
  progressController.handleEvent({ type: 'workflow-stage', stage: 'prepare', timestamp: Date.now() });

  const compiledInstructions = await requestCompiledInstructions({
    controlSelections: task.controlSelections,
    configVersion: task.moduleConfig.manifest.id,
  });

  progressController.handleEvent({ type: 'workflow-stage', stage: 'fetch-template', timestamp: Date.now() });

  const template = await templateService.getTemplate({
    evaluationGoal: task.input.evaluationGoal,
    outputMode: task.moduleConfig.manifest.outputMode,
  });

  progressController.handleEvent({ type: 'workflow-stage', stage: 'build-prompt', timestamp: Date.now() });

  const { messages, maxTokens } = buildAnalysisMessages({
    input: task.input,
    template,
    instructionText: compiledInstructions.instructionText,
    containers: task.moduleConfig.manifest.containers,
  });

  progressController.handleEvent({ type: 'workflow-stage', stage: 'request-model', timestamp: Date.now() });

  const result = await modelClient.call({
    baseUrl: task.modelConfig.baseUrl,
    apiKey: task.modelConfig.apiKey,
    model: task.modelConfig.selectedModel,
    messages,
    temperature: template.recommendedParameters.temperature,
    maxTokens,
    events: progressController.createEventHandlers(),
  });

  progressController.handleEvent({ type: 'workflow-stage', stage: 'extract-json', timestamp: Date.now() });

  const parsed = parseModelResponse(result.content);
  if (!parsed.success) {
    throw createAppError({
      code: 'provider_response_invalid',
      message: '模型返回的内容无法解析为有效的 JSON 格式，请重试。',
      retryable: true,
    });
  }

  const outputMode = getOutputMode(task.moduleConfig.manifest.outputMode);
  if (!outputMode) {
    throw createAppError({
      code: 'config_invalid',
      message: `未找到输出模式：${task.moduleConfig.manifest.outputMode}`,
      retryable: false,
    });
  }

  const createdAt = new Date().toISOString();
  const analysisResult: PersistedAnalysisReport = {
    reportId: task.id,
    moduleId: task.moduleConfig.manifest.id,
    outputMode: task.moduleConfig.manifest.outputMode,
    createdAt,
    rawJson: parsed.data,
    metadata: {
      model: task.modelConfig.selectedModel,
      baseUrl: task.modelConfig.baseUrl,
      templateVersion: template.version,
      scoringPolicyVersion: template.policyMeta.scoringPolicyVersion,
      conclusionPolicyVersion: template.policyMeta.conclusionPolicyVersion,
      evaluationGoal: task.input.evaluationGoal,
    },
    scoringContext: outputMode.buildScoringContext({
      moduleConfig: task.moduleConfig,
      controlSelections: task.controlSelections,
    }),
  };

  progressController.handleEvent({ type: 'workflow-stage', stage: 'normalize', timestamp: Date.now() });

  return analysisResult;
}
