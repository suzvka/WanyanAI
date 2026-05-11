/**
 * Key 格式校验工具
 * 
 * 纯函数，无服务端依赖，可在客户端和服务端使用。
 */

// Key 格式：32-64 字符的字母数字下划线横线组合
const KEY_PATTERN = /^[a-zA-Z0-9_-]{32,64}$/;

/**
 * 校验 key 格式是否有效
 * 
 * @param key - 要校验的 key
 * @returns 是否符合格式要求
 */
export function isValidKeyFormat(key: string): boolean {
  return typeof key === 'string' && KEY_PATTERN.test(key);
}
