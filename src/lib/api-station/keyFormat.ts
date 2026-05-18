/**
 * Key 格式校验工具
 *
 * 纯函数，可在客户端和服务端使用。
 */

/**
 * 标准 key 格式：字母数字下划线横线组合
 * 不约束长度——长度由认证服务自行校验，此处仅做字符集基本过滤。
 */
const STANDARD_KEY_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * 校验 key 格式是否有效
 *
 * @param key - 待校验的 key
 * @returns 是否符合标准格式
 */
export function isValidKeyFormat(key: string): boolean {
  return STANDARD_KEY_PATTERN.test(key);
}
