/**
 * ConfigStore 接口
 *
 * 运行时键值对缓存环境抽象层。
 * 所有子站的凭证配置、启停状态等运行时数据均通过此接口读写。
 *
 * 实现（依赖倒置：统一构建在数据库抽象 SqlDb 之上）：
 * - SqlDbConfigStore: runtime_config 表的 KV 视图，底层 SqlDb 由工厂注入——
 *   - postgres 渠道：kit PgSqlDb（DATABASE_URL）
 *   - coze 渠道：kit PgSqlDb（平台注入 PG* 变量组）
 *   - none 渠道：FileSqlDb（本地 json 文件模拟数据库行为，无真实库）
 *
 * 渠道唯一来源 = DATABASE_PROVIDER（postgres / coze / none），无独立存储开关。
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
