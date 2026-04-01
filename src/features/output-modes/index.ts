import { outputModeRegistry } from './registry';
import { reportJsonMode } from './report-json';

/**
 * 注册所有内置输出模式
 */
export function registerBuiltInOutputModes(): void {
  outputModeRegistry.register(reportJsonMode);
}

// 自动注册
registerBuiltInOutputModes();

// 导出注册表和工具函数
export { outputModeRegistry, getRegisteredOutputModes, getOutputModePrompt, getOutputMode } from './registry';

// 导出内置模式
export { reportJsonMode } from './report-json';
export type { OutputModeDefinition } from './registry';
