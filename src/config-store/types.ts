/**
 * ConfigStore 接口
 *
 * 运行时键值对缓存环境抽象层。
 * 所有子站的凭证配置、启停状态等运行时数据均通过此接口读写。
 *
 * 实现：
 * - FileConfigStore: 写入 runtime-config/<key>.json（开发/沙箱）
 * - GenericDbConfigStore: 写入通用 PostgreSQL runtime_config 表（生产，DATABASE_PROVIDER 分派连接串）
 *
 * 通过环境变量 CONFIG_STORE 选择实现：
 *   file → FileConfigStore（默认）
 *   db   → GenericDbConfigStore
 */

export interface ConfigStore {
  /**
   * 读取配置
   * @param key 配置键
   * @returns 配置值，不存在返回 null
   */
  get(key: string): Promise<string | null>;

  /**
   * 写入配置
   * @param key 配置键
   * @param value 配置值
   */
  set(key: string, value: string): Promise<void>;

  /**
   * 删除配置
   * @param key 配置键
   */
  delete(key: string): Promise<void>;

  /**
   * 按前缀批量查询
   * @param prefix 键前缀
   * @returns 匹配的键值对列表
   */
  list(prefix: string): Promise<{ key: string; value: string }[]>;
}