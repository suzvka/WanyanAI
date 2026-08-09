/**
 * 中转站加载器
 *
 * 负责在启动时加载并注册所有中转站。
 *
 * 设计原则：
 * 1. 静态导入所有已知中转站（受 Next.js 限制）
 * 2. 每个中转站自己决定是否启用（通过 getModels() 返回空数组 = 禁用）
 * 3. 删除中转站目录后，只需移除对应的 import 语句
 * 4. 支持注入宿主 logger 与配置目录（准库化：不依赖项目内部设施）
 */

import { stationRegistry } from './registry';
import { createOpenAIForwardStation } from './openai-forward';
import { createCozeStation } from './coze';
import { createLogger, type Logger } from './logger';

/** 默认 logger（未注入时的兜底实现） */
const defaultLogger = createLogger('StationLoader');

/** 加载状态标记 */
let initialized = false;

/**
 * 加载并注册所有中转站
 *
 * 此函数应在服务启动时调用一次。
 * 多次调用是幂等的。
 *
 * @param options.logger 宿主 logger（如 pino），未传入时使用 console 实现
 * @param options.configDir 配置根目录（透传给 openai-forward 站）
 */
export function initializeStations(options?: { logger?: Logger; configDir?: string }): void {
  const logger = options?.logger ?? defaultLogger;

  if (initialized) {
    logger.info('中转站已初始化，跳过');
    return;
  }

  logger.info('开始加载中转站...');

  // 注入宿主 logger 到注册表（单例在模块加载时已创建）
  stationRegistry.setLogger(options?.logger ?? createLogger('StationRegistry'));

  // 注册 openai-forward 中转站
  try {
    stationRegistry.register(createOpenAIForwardStation({ configDir: options?.configDir, logger }));
  } catch (error) {
    logger.error('注册 openai-forward 中转站失败', error);
  }

  // 注册 coze 中转站
  try {
    stationRegistry.register(createCozeStation({ logger }));
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
  defaultLogger.info('中转站已重置');
}
