'use client';

import type { ContainerComponentProps } from '@/containers/registry';
import AnalysisControlsPanel from '@/features/analysis-controls/components/AnalysisControlsPanel';
import { usePageContext } from '@/providers/PageContext';

/**
 * analysis-controls 容器组件
 * 
 * 渲染分析设置面板，这是固定存在的基础容器
 * 从 PageContext 获取分析控制数据
 */
export default function AnalysisControlsContainer(
  _props: ContainerComponentProps<Record<string, never>>,
) {
  const {
    moduleConfig,
    controlSelections,
    updateControlSelection,
    analysisState,
  } = usePageContext();

  const { controls } = moduleConfig;
  const isSubmitting = analysisState.status === 'running' || analysisState.status === 'recovering';

  return (
    <AnalysisControlsPanel
      title="分析设置"
      controls={controls.filter(c => c.enabled !== false && c.options?.length > 0)}
      controlSelections={controlSelections}
      isSubmitting={isSubmitting}
      onControlChange={updateControlSelection}
    />
  );
}
