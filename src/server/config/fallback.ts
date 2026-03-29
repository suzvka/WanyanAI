import 'server-only';

import type { PublishedOpsConfig } from './types';

export function createFallbackOpsConfig(): PublishedOpsConfig {
  return {
    source: 'fallback',
    manifest: {
      configVersion: 'fallback',
      publishedAt: new Date(0).toISOString(),
      publishedBy: 'system',
      environment: 'local',
    },
    site: {
      home: {
        title: '观者AI AudienceAI',
        subtitle: '',
      },
      inputPanel: {
        title: '文本输入',
        description: '支持多个文本块及块内批注。',
      },
      settingsPanel: {
        title: '分析设置',
        description: '当前未加载动态分析配置，将使用系统默认值。',
      },
      progress: {
        runningTitle: '正在准备客户端分析请求...',
        runningDescription: '服务端仅返回提示词模板，最终提示词拼接与模型调用均在浏览器内完成。',
      },
    },
    featureFlags: {
      enableFileUpload: true,
      enableAnnotations: true,
    },
    analysisControls: {
      groups: [
        {
          id: 'default',
          title: '分析设置',
          enabled: true,
          controls: [],
        },
      ],
      controls: [],
    },
    appearance: {
      brand: {
        name: 'AudienceAI',
        slogan: 'AI 驱动的文本诊断专家',
        fontFamily: 'var(--font-serif)',
      },
      theme: {
        primary: '#2e2e2e',
        backgroundOpacity: {
          light: 0.08,
          dark: 0.15,
        },
        brandColorOffset: {
          light: -0.15,
          dark: 0.1,
        },
      },
    },
  };
}
