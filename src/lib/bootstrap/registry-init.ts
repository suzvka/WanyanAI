/**
 * 服务端注册表统一初始化
 *
 * 提供中心化的注册表初始化入口，确保所有服务端注册表在使用前完成初始化。
 *
 * 设计原则：
 * 1. 幂等 — 重复调用安全，仅首次执行
 * 2. 统一入口 — 所有注册表初始化集中管理
 * 3. 显式依赖 — 通过 instrumentation.ts 在启动时预初始化
 */

import 'server-only';

import { createLogger } from '@/lib/api-station/logger';

const logger = createLogger('Bootstrap');

/** 服务端注册表初始化状态 */
let serverInitialized = false;

/**
 * 确保所有服务端注册表已初始化
 *
 * 统一入口，幂等操作。
 * - instrumentation.ts 启动时预初始化（主要路径）
 * - loader.ts 模块加载时调用（兜底）
 * - API 路由可安全调用（已初始化则跳过）
 */
export async function ensureServerRegistriesInitialized(): Promise<void> {
  if (serverInitialized) {
    logger.debug('服务端注册表已初始化，跳过');
    return;
  }

  logger.info('开始初始化服务端注册表...');

  // 动态导入避免循环依赖
  const { initializeControls } = await import('@/features/controls');
  const { initializeOutputModes } = await import('@/server/output-modes/registry');
  const { initializeStations } = await import('@/stations/loader');

  initializeControls();
  initializeOutputModes();
  initializeStations();

  serverInitialized = true;

  logger.info('服务端注册表初始化完成');
}

/**
 * 检查服务端注册表是否已初始化
 */
export function isServerInitialized(): boolean {
  return serverInitialized;
}

/**
 * 重置初始化状态（仅用于测试）
 */
export function resetServerInitialized(): void {
  serverInitialized = false;
  logger.debug('服务端注册表初始化状态已重置');
}
