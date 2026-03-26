import 'server-only';

import { defaultEvaluationInput } from '@/config/defaults';
import { evaluationGoalOptions, Option, textCompletenessOptions, textTypeOptions } from '@/config/evaluationOptions';
import { PublishedOpsConfig, CatalogOption, AnalysisControlConfig } from './types';

function toCatalogOptions<T extends string>(options: Option<T>[]): CatalogOption<T>[] {
  return options.map((option, index) => ({
    value: option.value,
    label: option.label,
    description: '',
    enabled: true,
    sortOrder: (index + 1) * 10,
  }));
}

function toAnalysisControlOptions<T extends string>(options: Option<T>[], promptTexts?: Partial<Record<T | 'none', string>>) {
  return options.map((option) => ({
    value: option.value,
    label: option.label,
    enabled: true,
    promptText: promptTexts?.[option.value] || '',
  }));
}

function moveOptionToFront<T extends string>(options: Option<T>[], targetValue: T) {
  const target = options.find((option) => option.value === targetValue);

  if (!target) {
    return options;
  }

  return [target, ...options.filter((option) => option.value !== targetValue)];
}

function createFallbackAnalysisControls(): AnalysisControlConfig[] {
  return [
    {
      id: 'text_type',
      title: '文本类型',
      enabled: true,
      sortOrder: 10,
      bindTo: 'textType',
      appliesTo: evaluationGoalOptions.map((option) => option.value),
      options: toAnalysisControlOptions(moveOptionToFront(textTypeOptions, defaultEvaluationInput.textType)),
    },
    {
      id: 'text_completeness',
      title: '文本完整度',
      enabled: true,
      sortOrder: 20,
      bindTo: 'textCompleteness',
      appliesTo: evaluationGoalOptions.map((option) => option.value),
      options: toAnalysisControlOptions(moveOptionToFront(textCompletenessOptions, defaultEvaluationInput.textCompleteness)),
    },
    {
      id: 'evaluation_goal',
      title: '本次评价目标',
      enabled: true,
      sortOrder: 30,
      bindTo: 'evaluationGoal',
      appliesTo: evaluationGoalOptions.map((option) => option.value),
      options: toAnalysisControlOptions(moveOptionToFront(evaluationGoalOptions, defaultEvaluationInput.evaluationGoal)),
    },
    {
      id: 'reader_preference',
      title: '目标读者偏好',
      enabled: true,
      sortOrder: 40,
      appliesTo: evaluationGoalOptions.map((option) => option.value),
      options: [
        { value: 'none', label: '不评价', enabled: true, promptText: '' },
        { value: 'fast_paced', label: '偏快节奏', enabled: true, promptText: '请优先从快节奏读者视角判断内容是否足够紧凑、信息投放是否及时。' },
        { value: 'plot_driven', label: '偏剧情推进', enabled: true, promptText: '请优先从剧情推进读者视角判断情节推进效率、事件驱动性与停滞风险。' },
        { value: 'character_emotion', label: '偏人物情感', enabled: true, promptText: '请优先从人物情感读者视角判断人物动机、关系推进与情绪张力是否充足。' },
        { value: 'world_building', label: '偏世界观/设定', enabled: true, promptText: '请优先从世界观与设定读者视角判断设定信息是否清晰、自然且有吸引力。' },
        { value: 'literary_expression', label: '偏文学表达', enabled: true, promptText: '请优先从重视文学表达的读者视角判断语言质感、修辞表现与叙述韵律。' },
        { value: 'general_reader', label: '通用读者', enabled: true, promptText: '请优先从通用读者视角判断整体可读性、理解成本与继续阅读意愿。' },
      ],
    },
    {
      id: 'feedback_style',
      title: '反馈风格',
      enabled: true,
      sortOrder: 50,
      appliesTo: evaluationGoalOptions.map((option) => option.value),
      options: [
        { value: 'none', label: '不评价', enabled: true, promptText: '' },
        { value: 'strict', label: '严格问题导向', enabled: true, promptText: '请采用直接、问题导向的反馈方式，优先指出影响结果的关键问题与修改优先级。' },
        { value: 'balanced', label: '平衡反馈', enabled: true, promptText: '请兼顾优点与问题，保持反馈平衡。' },
        { value: 'encouraging', label: '鼓励式反馈', enabled: true, promptText: '请保持鼓励式反馈，在指出问题时同时明确保留价值与可执行的改进方向。' },
      ],
    },
  ];
}

export function createFallbackOpsConfig(): PublishedOpsConfig {
  return {
    source: 'fallback',
    manifest: {
      configVersion: 'fallback',
      publishedAt: new Date(0).toISOString(),
      publishedBy: 'system',
      environment: process.env.NODE_ENV === 'production' ? 'production' : 'local',
    },
    site: {
      home: {
        title: 'AI 文本完成度诊断系统',
        subtitle: '服务端提供提示词模板，客户端直连模型完成评估',
        modelHint: '当前使用内置默认配置',
      },
      inputPanel: {
        title: '文本输入',
        description: '支持多个文本块及块内批注。',
      },
      settingsPanel: {
        title: '分析设置',
        description: '配置您的分析偏好',
      },
      progress: {
        runningTitle: '正在准备客户端分析请求...',
        runningDescription: '服务端仅返回提示词模板，最终提示词拼接与模型调用均在浏览器内完成。',
      },
      errors: {
        generic: '配置读取失败，已自动使用默认配置。',
      },
    },
    catalog: {
      textTypes: toCatalogOptions(textTypeOptions),
      textCompletenessOptions: toCatalogOptions(textCompletenessOptions),
      evaluationGoals: toCatalogOptions(evaluationGoalOptions),
    },
    defaults: {
      textType: defaultEvaluationInput.textType,
      textCompleteness: defaultEvaluationInput.textCompleteness,
      evaluationGoal: defaultEvaluationInput.evaluationGoal,
    },
    featureFlags: {
      enableFileUpload: true,
      enableAnnotations: true,
    },
    analysisControls: {
      controls: createFallbackAnalysisControls(),
    },
  };
}
