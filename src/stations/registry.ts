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
   *
   * 每次调用都实时拉取各子站最新模型列表，不做跨请求缓存：
   * 各子站自身管理内存缓存（Coze 启停、OpenAI Forward 配置），
   * 避免注册表级缓存与子站变更（模型启停/配置更新）不同步。
   */
  async getAllModels(): Promise<StationModel[]> {
    const models: StationModel[] = [];

    for (const station of this.modules.values()) {
      try {
        const stationModels = await station.getModels();
        models.push(...stationModels);
      } catch (error) {
        this.logger.error(`获取中转站 ${station.id} 的模型列表失败`, error);
      }
    }

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
   * 判断模型是否"存在但被停用"（用于区分 MODEL_DISABLED 与 MODEL_NOT_FOUND）
   *
   * 遍历所有可处理该模型的中转站，查询其启停状态（AdminManagedStation 能力）。
   * 查询失败或无法判断时返回 false，交由调用方按 MODEL_NOT_FOUND 兜底。
   */
  async isModelDisabled(modelId: string): Promise<boolean> {
    for (const station of this.modules.values()) {
      if (!station.canHandle(modelId)) continue;
      const admin = station as unknown as AdminManagedStation;
      if (typeof admin.getModelToggles !== 'function') continue;
      try {
        const toggles = await admin.getModelToggles();
        const toggle = toggles.find(t => t.id === modelId);
        if (toggle && !toggle.enabled) return true;
      } catch {
        // 查询失败时忽略该站，继续下一个
      }
    }
    return false;
  }

  /**
   * 使模型列表缓存失效
   *
   * 中转站模型列表可能因运行期变更（如 Coze 模型启停、配置更新）而变化，
   * 变更方调用此方法后，下次 getAllModels() 将重新拉取各子站的最新模型。
   */
  invalidateModelsCache(): void {
    this.modelsCache = null;
    this.logger.info('模型列表缓存已失效');
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

// 单例实例（挂载到 globalThis，防止 Next.js dev 下 ESM/CJS 双加载产生两个实例）
const g = globalThis as unknown as { __stationRegistry?: StationRegistryImpl };
export const stationRegistry = g.__stationRegistry ?? (g.__stationRegistry = new StationRegistryImpl());
