/**
 * Key 格式验证器 - 示例
 *
 * 入参：{ key: string | null }
 * 返回：boolean（true = 格式合法，false = 拒绝请求）
 *
 * 注意：key 可能为 null（请求未携带 Authorization 头），
 * 验证器需自行决定是否允许空 key。
 *
 * 用法：
 *   1. 复制此文件夹，重命名为你的策略名
 *   2. 修改 main.js 中的验证逻辑
 *   3. 部署即可生效，无需修改项目代码
 *
 * 系统会扫描 key-validators/ 下所有子文件夹中的 main.js，
 * 依次执行，全部返回 true 才视为通过。
 * 如果没有任何验证器（目录为空或不存在），默认放行。
 */

module.exports = function validateKey(params) {
  const { key } = params;

  // 示例：不允许空 key
  if (!key) return false;

  // key 必须是 8-64 位字母数字 + 下划线/横线组合
  // 请根据实际业务替换此逻辑
  return /^[a-zA-Z0-9_-]{8,64}$/.test(key);
};
