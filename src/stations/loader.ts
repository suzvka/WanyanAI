/**
 * 中转站加载器
 * 
 * 负责在启动时加载并注册所有中转站。
 * 
 * 设计原则：
 * 1. 静态导入所有已知中转站（受 Next.js 限制）
 * 2. 每个中转站自己决定是否启用（通过 getModels() 返回空数组 = 禁用）
 * 3. 删除中转站目录后，只需移除对应的 import 语句
 */

import { stationRegistry } from './registry';
import { openaiForwardStation } from './openai-forward';
import { cozeStation } from './coze';
import { createLogger } from '@/lib/api-station/logger';

const logger = createLogger('StationLoader');

/** 加载状态标记 */
let initialized = false;

/**
 * 加载并注册所有中转站
 * 
 * 此函数应在服务启动时调用一次。
 * 多次调用是幂等的。
 */
export function initializeStations(): void {
  if (initialized) {
    logger.info('中转站已初始化，跳过');
    return;
  }

  logger.info('开始加载中转站...');

  // 注册 openai-forward 中转站
  try {
    stationRegistry.register(openaiForwardStation);
  } catch (error) {
    logger.error('注册 openai-forward 中转站失败', error);
  }

  // 注册 coze 中转站
  try {
    stationRegistry.register(cozeStation);
  } catch (error) {
    logger.error('注册 coze 中转站失败', error);
  }

  initialized = true;
  
  const stations = stationRegistry.getStations();
  logger.info('中转站加载完成', {
    stationCount: stations.length,
    stationIds: stations.map(s => s.id),
  });
}

/**
 * 重置中转站（用于测试）
 */
export function resetStations(): void {
  stationRegistry.reset();
  initialized = false;
  logger.info('中转站已重置');
}
