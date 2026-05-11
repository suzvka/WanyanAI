/**
 * 中转站模块入口
 */

export * from './types';
export { stationRegistry } from './registry';
export { initializeStations, resetStations } from './loader';

// 导出具体中转站（供外部直接使用或测试）
export { openaiForwardStation } from './openai-forward';
export { cozeStation, isCozeEnvironment } from './coze';
