/**
 * 中转站注册表
 *
 * 管理所有已注册的中转站，提供模型查找和请求转发能力。
 * 继承 BaseRegistry 统一生命周期管理。
 */

import type { Station, StationModel, StationRegistry as IStationRegistry } from './types';
import { BaseRegistry } from '@/lib/registry/BaseRegistry';
import { createLogger } from '@/lib/api-station/logger';

const logger = createLogger('StationRegistry');

/**
 * 中转站注册表实现
 */
class StationRegistryImpl extends BaseRegistry<Station> implements IStationRegistry {
  private modelsCache: StationModel[] | null = null;

  constructor() {
    super('StationRegistry');
  }

  /**
   * 注册中转站（覆盖基类以清除模型缓存）
   */
  register(station: Station): void {
    super.register(station);
    this.modelsCache = null;
    logger.info('中转站已注册', { stationId: station.id, stationName: station.name });
  }

  /**
   * 获取所有可用的模型
   */
  async getAllModels(): Promise<StationModel[]> {
    if (this.modelsCache) {
      return this.modelsCache;
    }

    const models: StationModel[] = [];

    for (const station of this.modules.values()) {
      try {
        const stationModels = await station.getModels();
        models.push(...stationModels);
      } catch (error) {
        logger.error(`获取中转站 ${station.id} 的模型列表失败`, error);
      }
    }

    this.modelsCache = models;
    logger.info('模型列表已更新', { totalModels: models.length });

    return models;
  }

  /**
   * 查找能处理指定模型的中转站
   */
  findStation(modelId: string): Station | null {
    for (const station of this.modules.values()) {
      if (station.canHandle(modelId)) {
        return station;
      }
    }

    return null;
  }

  /**
   * 获取所有已注册的中转站
   */
  getStations(): Station[] {
    return Array.from(this.modules.values());
  }

  /**
   * 重置注册表（覆盖基类以清除模型缓存）
   */
  reset(): void {
    super.reset();
    this.modelsCache = null;
    logger.info('注册表已重置');
  }
}

// 单例实例
export const stationRegistry = new StationRegistryImpl();
