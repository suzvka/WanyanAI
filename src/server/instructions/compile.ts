import 'server-only';

import { getPublishedOpsConfig } from '@/server/config';
import { createAppError } from '@/types/errors';
import type { CompileInstructionsRequest, CompileInstructionsSuccessResponse } from '@/types/instructions';

function createStaleConfigError() {
  return createAppError({
    code: 'ops_config_stale',
    message: '当前页面配置已更新，请先保存输入内容后手动刷新页面。',
    status: 409,
  });
}

function createInvalidControlSelectionError() {
  return createAppError({
    code: 'invalid_control_selection',
    message: '当前所选检查项已失效，请刷新页面后重新选择。',
    status: 409,
  });
}

export async function compileDynamicInstructions(
  request: CompileInstructionsRequest,
): Promise<CompileInstructionsSuccessResponse> {
  const opsConfig = await getPublishedOpsConfig();

  if (request.configVersion !== opsConfig.manifest.configVersion) {
    throw createStaleConfigError();
  }

  const resolvedSelections: Record<string, string> = {};
  const instructionParts: string[] = [];

  for (const [controlId, selectedValue] of Object.entries(request.controlSelections)) {
    const control = opsConfig.analysisControls.controls.find(
      (item) => item.id === controlId && item.enabled,
    );
    if (!control) {
      throw createInvalidControlSelectionError();
    }

    const option = control.options.find((item) => item.value === selectedValue && item.enabled);
    if (!option) {
      throw createInvalidControlSelectionError();
    }

    resolvedSelections[controlId] = option.value;
    if (option.promptText.trim()) {
      instructionParts.push(option.promptText.trim());
    }
  }

  return {
    instructionText: instructionParts.join('\n'),
    resolvedSelections,
    configVersion: opsConfig.manifest.configVersion,
  };
}
