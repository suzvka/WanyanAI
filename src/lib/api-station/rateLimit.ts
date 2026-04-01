import { logInfo, logWarn, LogContext } from './logger';
import { getRateLimitConfig } from './forwardConfig';

// 限流结果接口
export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  errorCode?: string;
}

// 全局限流数据（内存存储）
const globalRequests: number[] = [];

// 浏览器限流数据（内存存储）
const browserRequests = new Map<string, number[]>();

/**
 * 清理过期的请求记录
 */
function cleanupOldRequests(requests: number[], maxAgeMs: number): number[] {
  const now = Date.now();
  return requests.filter(timestamp => now - timestamp < maxAgeMs);
}

/**
 * 检查全局限流
 */
function checkGlobalRateLimit(maxPerMinute: number): RateLimitResult {
  const now = Date.now();
  const maxAgeMs = 60 * 1000; // 1 分钟

  // 清理过期记录
  const recentGlobal = cleanupOldRequests(globalRequests, maxAgeMs);

  // 检查是否超限
  if (recentGlobal.length >= maxPerMinute) {
    logWarn('[RateLimit] 全局限流触发', {
      current: recentGlobal.length,
      limit: maxPerMinute,
      timeWindow: '1 minute'
    });
    return {
      allowed: false,
      reason: 'Global rate limit exceeded',
      errorCode: 'GLOBAL_RATE_LIMIT_EXCEEDED'
    };
  }

  // 记录新请求
  globalRequests.push(now);
  return { allowed: true };
}

/**
 * 检查浏览器限流
 */
function checkBrowserRateLimit(
  browserId: string,
  maxPerHour: number
): RateLimitResult {
  const now = Date.now();
  const maxAgeMs = 60 * 60 * 1000; // 1 小时

  // 获取该浏览器的请求记录
  let recentBrowser = browserRequests.get(browserId) || [];

  // 清理过期记录
  recentBrowser = cleanupOldRequests(recentBrowser, maxAgeMs);

  // 检查是否超限
  if (recentBrowser.length >= maxPerHour) {
    logWarn('[RateLimit] 浏览器限流触发', {
      browserId,
      current: recentBrowser.length,
      limit: maxPerHour,
      timeWindow: '1 hour'
    });
    return {
      allowed: false,
      reason: 'Browser rate limit exceeded',
      errorCode: 'BROWSER_RATE_LIMIT_EXCEEDED'
    };
  }

  // 记录新请求
  recentBrowser.push(now);
  browserRequests.set(browserId, recentBrowser);

  logInfo('[RateLimit] 浏览器限流检查通过', {
    browserId,
    currentCount: recentBrowser.length,
    limit: maxPerHour
  });

  return { allowed: true };
}

/**
 * 检查限流（全局 + 浏览器）
 * @param browserId - 浏览器 ID
 * @returns 限流检查结果
 */
export function checkRateLimit(browserId: string): RateLimitResult {
  const config = getRateLimitConfig();

  // 1. 检查全局限流
  const globalResult = checkGlobalRateLimit(config.globalMaxCallsPerMinute);
  if (!globalResult.allowed) {
    return globalResult;
  }

  // 2. 检查浏览器限流
  const browserResult = checkBrowserRateLimit(browserId, config.browserMaxCallsPerHour);
  return browserResult;
}

/**
 * 获取当前限流统计信息（用于监控）
 */
export function getRateLimitStats() {
  const now = Date.now();
  const config = getRateLimitConfig();

  // 全局统计
  const recentGlobal = cleanupOldRequests(globalRequests, 60 * 1000);
  const globalStats = {
    current: recentGlobal.length,
    limit: config.globalMaxCallsPerMinute,
    timeWindow: '1 minute'
  };

  // 浏览器统计（取最近 10 个浏览器）
  const recentBrowsers: Record<string, any> = {};
  for (const [browserId, requests] of browserRequests.entries()) {
    if (recentBrowsers.length >= 10) break;
    const recentRequests = cleanupOldRequests(requests, 60 * 60 * 1000);
    recentBrowsers[browserId] = {
      current: recentRequests.length,
      limit: config.browserMaxCallsPerHour,
      timeWindow: '1 hour'
    };
  }

  return {
    global: globalStats,
    browsers: recentBrowsers,
    totalBrowsers: browserRequests.size
  };
}
