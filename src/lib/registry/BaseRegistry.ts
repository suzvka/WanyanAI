/**
 * 注册表基类
 *
 * 统一所有注册表（控件、输出模式、容器）的生命周期约定：
 *
 * 1. 延迟初始化 — 单例在 import 时创建（无副作用），内置模块通过 initialize() 显式注册
 * 2. 幂等 — 重复调用 initialize() 安全，仅输出警告
 * 3. 可重置 — reset() 清空所有模块 + 重置初始化标记，用于测试隔离
 * 4. 环境无关 — 不依赖 server-only，客户端和服务端均可继承
 *
 * @typeParam TModule - 注册表中存储的模块类型，必须包含 string 类型的 id 字段
 */

import { createLogger } from '@/lib/api-station/logger';

export abstract class BaseRegistry<TModule extends { id: string }> {
  protected modules = new Map<string, TModule>();
  private initialized = false;
  private readonly logLabel: string;
  private readonly logger;

  constructor(logLabel: string) {
    this.logLabel = logLabel;
    this.logger = createLogger(logLabel);
  }

  // ─── 生命周期 ───────────────────────────────────────

  /** 是否已完成初始化 */
  get isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * 初始化注册表（注册内置模块）
   *
   * @param registerBuiltin 注册回调，由子类或 manifest 提供
   *
   * 幂等：重复调用仅输出警告
   */
  initialize(registerBuiltin: () => void): void {
    if (this.initialized) {
      this.logger.warn('已初始化，跳过重复调用');
      return;
    }
    registerBuiltin();
    this.initialized = true;
    this.logger.info('初始化完成', { modules: this.getIds() });
  }

  /**
   * 重置注册表（清空所有已注册模块 + 重置初始化标记）
   *
   * 用于测试隔离或运行时重建。
   */
  reset(): void {
    this.modules.clear();
    this.initialized = false;
  }

  // ─── 通用操作 ───────────────────────────────────────

  /**
   * 注册模块
   *
   * 重复注册同一 id 会输出警告并覆盖
   */
  register(module: TModule): void {
    if (this.modules.has(module.id)) {
      this.logger.warn('模块已存在，将被覆盖', { id: module.id });
    }
    this.modules.set(module.id, module);
  }

  /** 获取模块 */
  get(id: string): TModule | undefined {
    return this.modules.get(id);
  }

  /** 检查模块是否存在 */
  has(id: string): boolean {
    return this.modules.has(id);
  }

  /** 获取所有已注册模块 ID */
  getIds(): string[] {
    return Array.from(this.modules.keys());
  }
}
