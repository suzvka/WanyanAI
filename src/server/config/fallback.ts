import 'server-only';

import { defaultEvaluationInput } from '@/config/defaults';
import {
  evaluationGoalOptions,
  feedbackStyleOptions,
  Option,
  readerPreferenceOptions,
  specialConstraintOptions,
  textCompletenessOptions,
  textTypeOptions,
} from '@/config/evaluationOptions';
import { PublishedOpsConfig, CatalogOption } from './types';

function toCatalogOptions<T extends string>(options: Option<T>[]): CatalogOption<T>[] {
  return options.map((option, index) => ({
    value: option.value,
    label: option.label,
    description: '',
    enabled: true,
    sortOrder: (index + 1) * 10,
  }));
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
        description: '支持主文本块、整体说明块与局部说明。',
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
      readerPreferences: toCatalogOptions(readerPreferenceOptions),
      feedbackStyles: toCatalogOptions(feedbackStyleOptions),
      specialConstraints: toCatalogOptions(specialConstraintOptions),
    },
    defaults: {
      textType: defaultEvaluationInput.textType,
      textCompleteness: defaultEvaluationInput.textCompleteness,
      evaluationGoal: defaultEvaluationInput.evaluationGoal,
      readerPreference: defaultEvaluationInput.readerPreference,
      feedbackStyle: defaultEvaluationInput.feedbackStyle,
      specialConstraints: defaultEvaluationInput.specialConstraints || [],
    },
    featureFlags: {
      enableFileUpload: true,
      enableGlobalSupplementBlocks: true,
      enableLocalSupplements: true,
      enableReaderPreference: true,
      enableFeedbackStyle: true,
      enableSpecialConstraints: true,
    },
  };
}
