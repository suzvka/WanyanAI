/**
 * 中转站注册表
 *
 * 管理所有已注册的中转站，提供模型查找和请求转发能力。
 * 自包含实现：不依赖项目内部注册表基类，仅依赖本模块的日志抽象。
 */

import type { Station, StationModel, StationRegistry as IStationRegistry, AdminManagedStation } from './types';
import { createLogger, type Logger } from './logger';

/**
 * 中转站注册表实现
 */
class StationRegistryImpl implements IStationRegistry {
  private modules = new Map<string, Station>();
  private modelsCache: StationModel[] | null = null;
  private logger: Logger;

  constructor(options?: { logger?: Logger }) {
    this.logger = options?.logger ?? createLogger('StationRegistry');
  }

  /**
   * 运行时注入 logger（单例在模块加载时创建，由 loader 注入宿主 logger）
   */
  setLogger(logger: Logger): void {
    this.logger = logger;
  }

  /**
   * 注册中转站（重复注册同一 id 时输出警告并覆盖，同时清除模型缓存）
   */
  register(station: Station): void {
    if (this.modules.has(station.id)) {
      this.logger.warn('中转站已存在，将被覆盖', { stationId: station.id });
    }
    this.modules.set(station.id, station);
    this.modelsCache = null;
    this.logger.info('中转站已注册', { stationId: station.id, stationName: station.name });
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
        this.logger.error(`获取中转站 ${station.id} 的模型列表失败`, error);
      }
    }

    this.modelsCache = models;
    this.logger.info('模型列表已更新', { totalModels: models.length });

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
   * 查找指定模型的元数据（含 minPermissionLevel 等策略声明）
   */
  async findModel(modelId: string): Promise<StationModel | null> {
    const models = await this.getAllModels();
    return models.find(m => m.id === modelId) ?? null;
  }

  /**
   * 获取所有已注册的中转站
   */
  getStations(): Station[] {
    return Array.from(this.modules.values());
  }

  /**
   * 获取所有实现了 AdminManagedStation 的子站
   */
  getAdminManagedStations(): AdminManagedStation[] {
    const stations: AdminManagedStation[] = [];
    for (const station of this.modules.values()) {
      if ('getCredentialSchema' in station && 'updateCredentialConfig' in station) {
        stations.push(station as unknown as AdminManagedStation);
      }
    }
    return stations;
  }

  /**
   * 重置注册表（清空所有中转站 + 清除模型缓存）
   */
  reset(): void {
    this.modules.clear();
    this.modelsCache = null;
    this.logger.info('注册表已重置');
  }
}

// 单例实例
export const stationRegistry = new StationRegistryImpl();
