'use client';

import { useEffect, useMemo, useState } from 'react';
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

  useEffect(() => {
    setControlSelections((prev) =>
      synchronizeControlSelections(dynamicControls, prev),
    );
  }, [dynamicControls]);

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
