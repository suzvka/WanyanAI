import { outputModeRegistry } from './registry';
import { literaryReviewMode } from './literary-review';
import { gaokaoEssayMode } from './gaokao-essay';

/**
 * 注册所有内置输出模式
 */
export function registerBuiltInOutputModes(): void {
  outputModeRegistry.register(literaryReviewMode);
  outputModeRegistry.register(gaokaoEssayMode);
}

// 自动注册
registerBuiltInOutputModes();

// 导出注册表和工具函数
export { outputModeRegistry, getRegisteredOutputModes, getOutputModePrompt, getOutputMode } from './registry';

// 导出内置模式
export { literaryReviewMode } from './literary-review';
export { gaokaoEssayMode } from './gaokao-essay';
export type { OutputModeDefinition } from './registry';
