/**
 * Key 格式校验工具
 * 
 * 纯函数，无服务端依赖，可在客户端和服务端使用。
 */

// 标准 Key 格式：32-64 字符的字母数字下划线横线组合
const STANDARD_KEY_PATTERN = /^[a-zA-Z0-9_-]{32,64}$/;

// 游客 Key 格式：guest_local_<timestamp>_<random>
const GUEST_KEY_PATTERN = /^guest_local_\d+_[a-zA-Z0-9]+$/;

/**
 * 校验 key 格式是否有效
 * 
 * 支持两种格式：
 * 1. 标准格式：32-64 字符的字母数字下划线横线组合
 * 2. 游客格式：guest_local_<timestamp>_<random>
 * 
 * @param key - 要校验的 key
 * @returns 是否符合格式要求
 */
export function isValidKeyFormat(key: string): boolean {
  if (typeof key !== 'string') {
    return false;
  }
  return STANDARD_KEY_PATTERN.test(key) || GUEST_KEY_PATTERN.test(key);
}

/**
 * 检查 key 是否为游客 key
 * 
 * @param key - 要检查的 key
 * @returns 是否为游客 key
 */
export function isGuestKey(key: string): boolean {
  return typeof key === 'string' && GUEST_KEY_PATTERN.test(key);
}
