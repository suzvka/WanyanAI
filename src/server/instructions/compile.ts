import 'server-only';

import { getPageModuleBySlug } from '@/server/modules';
import { controlRegistry } from '@/features/controls';
import { createAppError } from '@/types/errors';
import type { CompileInstructionsRequest, CompileInstructionsSuccessResponse } from '@/types/instructions';

function createStaleConfigError() {
  return createAppError({
    code: 'ops_config_stale',
    message: '当前页面配置已更新，请先保存输入内容后手动刷新页面。',
    status: 409,
  });
}

export async function compileDynamicInstructions(
  request: CompileInstructionsRequest,
): Promise<CompileInstructionsSuccessResponse> {
  // configVersion 现在是页面模块 slug
  const moduleConfig = await getPageModuleBySlug(request.configVersion);

  if (!moduleConfig) {
    throw createStaleConfigError();
  }

  // 使用控件注册表批量编译
  const result = controlRegistry.compileAll(
    moduleConfig.controls,
    request.controlSelections,
  );

  return {
    instructionText: result.instruction,
    resolvedSelections: request.controlSelections,
    configVersion: moduleConfig.manifest.slug,
  };
}
