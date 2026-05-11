/**
 * 中转站注册表
 * 
 * 管理所有已注册的中转站，提供模型查找和请求转发能力。
 */

import type { Station, StationModel, StationRegistry as IStationRegistry } from './types';
import { createLogger } from '@/lib/api-station/logger';

const logger = createLogger('StationRegistry');

/**
 * 中转站注册表实现
 */
class StationRegistryImpl implements IStationRegistry {
  private stations: Map<string, Station> = new Map();
  private modelsCache: StationModel[] | null = null;
  
  /**
   * 注册中转站
   */
  register(station: Station): void {
    if (this.stations.has(station.id)) {
      logger.warn(`中转站 ${station.id} 已存在，将被覆盖`);
    }
    
    this.stations.set(station.id, station);
    this.modelsCache = null; // 清除缓存
    
    logger.info(`中转站已注册`, { stationId: station.id, stationName: station.name });
  }
  
  /**
   * 获取所有可用的模型
   */
  async getAllModels(): Promise<StationModel[]> {
    if (this.modelsCache) {
      return this.modelsCache;
    }
    
    const models: StationModel[] = [];
    
    for (const station of this.stations.values()) {
      try {
        const stationModels = await station.getModels();
        models.push(...stationModels);
      } catch (error) {
        logger.error(`获取中转站 ${station.id} 的模型列表失败`, error);
      }
    }
    
    this.modelsCache = models;
    logger.info(`模型列表已更新`, { totalModels: models.length });
    
    return models;
  }
  
  /**
   * 查找能处理指定模型的中转站
   */
  findStation(modelId: string): Station | null {
    for (const station of this.stations.values()) {
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
    return Array.from(this.stations.values());
  }
  
  /**
   * 重置注册表
   */
  reset(): void {
    this.stations.clear();
    this.modelsCache = null;
    logger.info('注册表已重置');
  }
}

// 单例实例
export const stationRegistry = new StationRegistryImpl();
