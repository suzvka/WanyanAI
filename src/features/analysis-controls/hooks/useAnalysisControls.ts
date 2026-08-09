'use client';

import { useMemo, useState } from 'react';
import type { PageModuleConfig as ModuleConfig } from '@/types/module';
import {
  buildActiveControlSelections,
  getEnabledDynamicControls,
  resolveInitialControlSelections,
  synchronizeControlSelections,
} from '../lib/controlSelection';

type UseAnalysisControlsOptions = {
  moduleConfig: ModuleConfig;
};

export function useAnalysisControls({
  moduleConfig,
}: UseAnalysisControlsOptions) {
  const [controlSelections, setControlSelections] = useState<Record<string, string>>(() =>
    resolveInitialControlSelections(
      getEnabledDynamicControls(moduleConfig),
    ),
  );

  const dynamicControls = useMemo(
    () => getEnabledDynamicControls(moduleConfig),
    [moduleConfig],
  );

  // 控件配置变化时同步选择状态（渲染期调整，避免 effect 级联渲染）
  const [prevControls, setPrevControls] = useState(dynamicControls);
  if (prevControls !== dynamicControls) {
    setPrevControls(dynamicControls);
    setControlSelections((prev) =>
      synchronizeControlSelections(dynamicControls, prev),
    );
  }

  function handleControlChange(controlId: string, value: string) {
    setControlSelections((prev) => ({
      ...prev,
      [controlId]: value,
    }));
  }

  return {
    controlSelections,
    dynamicControls,
    activeControlSelections: buildActiveControlSelections(dynamicControls, controlSelections),
    handleControlChange,
  };
}
