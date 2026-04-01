import type { ModuleConfig } from '@/types/module';
import type { SiteConfig, AnalysisControlsConfig } from '@/server/config/types';

/**
 * 创建 fallback 模块配置
 */
export function createFallbackModuleConfig(): ModuleConfig {
  return {
    source: 'fallback',
    manifest: {
      id: 'novel-evaluate',
      name: '小说评价报告',
      description: 'AI 驱动的小说文本深度诊断',
      route: '/evaluate/novel-evaluate',
      containers: [
        { type: 'analysis-controls' },
        { 
          type: 'text-blocks', 
          params: { 
            blockType: 'actual_text', 
            defaultExpanded: true, 
            initialBlockCount: 1 
          } 
        },
      ],
      outputMode: 'report-json',
      sidebar: {
        enabled: true,
        icon: 'BookOpen',
        order: 1,
      },
    },
    site: {
      home: {
        title: '小说评价报告',
        subtitle: '上传文本，获取深度分析',
      },
      inputPanel: {
        title: '文本输入',
        description: '仅针对正文进行评析。',
      },
      settingsPanel: {
        title: '分析设置',
        description: '',
      },
      progress: {
        runningTitle: '正在准备分析请求...',
        runningDescription: '',
      },
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
  };
}
