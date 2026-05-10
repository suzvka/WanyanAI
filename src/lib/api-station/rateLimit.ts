import { logInfo, logWarn } from './logger';
import {
  loadRateLimitConfig,
  getRateLimitRule,
  isUnspecifiedLevelAllowed,
  type RateLimitRule,
} from './rateLimitConfig';

// ========== 类型定义 ==========

/**
 * 限流检查结果
 */
export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  errorCode?: string;
  /** 触发限时返回，剩余等待秒数 */
  retryAfter?: number;
  /** 当前配额状态（用于响应头） */
  quota?: {
    limit: number;
    remaining: number;
    reset: number;
  };
}

/**
 * 限流检查参数
 */
export interface RateLimitParams {
  /** 用户或游客标识 */
  subjectId: string;
  /** 权限等级 */
  permissionLevel: number;
}

// ========== 存储结构 ==========

// 按权限等级隔离的全局请求记录
// Map<permissionLevel, timestamp[]>
const globalRequestsByLevel = new Map<number, number[]>();

// 按权限等级隔离的用户请求记录
// Map<permissionLevel, Map<subjectId, timestamp[]>>
const userRequestsByLevel = new Map<number, Map<string, number[]>>();

// ========== 工具函数 ==========

/**
 * 清理过期的请求记录
 */
function cleanupOldRequests(requests: number[], maxAgeMs: number): number[] {
  const now = Date.now();
  return requests.filter(timestamp => now - timestamp < maxAgeMs);
}

/**
 * 计算剩余等待时间（秒）
 */
function calculateRetryAfter(requests: number[], maxCalls: number, windowMs: number): number {
  if (requests.length < maxCalls) {
    return 0;
  }

  const now = Date.now();
  // 找到最早的请求时间
  const oldestRequest = Math.min(...requests);
  // 计算该请求何时过期
  const expiresAt = oldestRequest + windowMs;
  
  return Math.ceil((expiresAt - now) / 1000);
}

// ========== 限流检查函数 ==========

/**
 * 检查全局限流（按权限等级隔离）
 */
function checkGlobalRateLimit(
  permissionLevel: number,
  rule: RateLimitRule
): RateLimitResult {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 小时
  const maxCalls = rule.global.maxCallsPerHour;

  // 获取该等级的全局请求记录
  let requests = globalRequestsByLevel.get(permissionLevel) || [];
  requests = cleanupOldRequests(requests, windowMs);

  // 计算配额状态
  const remaining = Math.max(0, maxCalls - requests.length);
  const oldestRequest = requests.length > 0 ? Math.min(...requests) : now;
  const reset = Math.floor((oldestRequest + windowMs) / 1000);

  // 检查是否超限
  if (requests.length >= maxCalls) {
    const retryAfter = calculateRetryAfter(requests, maxCalls, windowMs);
    
    logWarn('[RateLimit] 全局限流触发', {
      permissionLevel,
      current: requests.length,
      limit: maxCalls,
      timeWindow: '1 hour',
      retryAfter,
    });

    return {
      allowed: false,
      reason: `Global rate limit exceeded for permission level ${permissionLevel}`,
      errorCode: 'GLOBAL_RATE_LIMIT_EXCEEDED',
      retryAfter,
      quota: { limit: maxCalls, remaining: 0, reset },
    };
  }

  // 记录新请求
  requests.push(now);
  globalRequestsByLevel.set(permissionLevel, requests);

  return {
    allowed: true,
    quota: { limit: maxCalls, remaining: remaining - 1, reset },
  };
}

/**
 * 检查用户级限流
 */
function checkUserRateLimit(
  subjectId: string,
  permissionLevel: number,
  rule: RateLimitRule
): RateLimitResult {
  const now = Date.now();
  const minuteWindowMs = 60 * 1000;
  const hourWindowMs = 60 * 60 * 1000;

  // 获取该等级的用户请求记录
  let userMap = userRequestsByLevel.get(permissionLevel);
  if (!userMap) {
    userMap = new Map();
    userRequestsByLevel.set(permissionLevel, userMap);
  }

  const requests = userMap.get(subjectId) || [];

  // 检查每分钟限流
  const minuteRequests = cleanupOldRequests([...requests], minuteWindowMs);
  if (minuteRequests.length >= rule.perUser.maxCallsPerMinute) {
    const retryAfter = calculateRetryAfter(minuteRequests, rule.perUser.maxCallsPerMinute, minuteWindowMs);
    
    logWarn('[RateLimit] 用户每分钟限流触发', {
      subjectId,
      permissionLevel,
      current: minuteRequests.length,
      limit: rule.perUser.maxCallsPerMinute,
      timeWindow: '1 minute',
      retryAfter,
    });

    return {
      allowed: false,
      reason: 'User rate limit exceeded (per minute)',
      errorCode: 'USER_RATE_LIMIT_EXCEEDED_MINUTE',
      retryAfter,
      quota: {
        limit: rule.perUser.maxCallsPerMinute,
        remaining: 0,
        reset: Math.floor((Math.min(...minuteRequests) + minuteWindowMs) / 1000),
      },
    };
  }

  // 检查每小时限流
  const hourRequests = cleanupOldRequests(requests, hourWindowMs);
  if (hourRequests.length >= rule.perUser.maxCallsPerHour) {
    const retryAfter = calculateRetryAfter(hourRequests, rule.perUser.maxCallsPerHour, hourWindowMs);
    
    logWarn('[RateLimit] 用户每小时限流触发', {
      subjectId,
      permissionLevel,
      current: hourRequests.length,
      limit: rule.perUser.maxCallsPerHour,
      timeWindow: '1 hour',
      retryAfter,
    });

    return {
      allowed: false,
      reason: 'User rate limit exceeded (per hour)',
      errorCode: 'USER_RATE_LIMIT_EXCEEDED_HOUR',
      retryAfter,
      quota: {
        limit: rule.perUser.maxCallsPerHour,
        remaining: 0,
        reset: Math.floor((Math.min(...hourRequests) + hourWindowMs) / 1000),
      },
    };
  }

  // 记录新请求
  requests.push(now);
  userMap.set(subjectId, requests);

  // 计算配额状态（使用小时配额）
  const remaining = Math.max(0, rule.perUser.maxCallsPerHour - hourRequests.length - 1);
  const oldestRequest = hourRequests.length > 0 ? Math.min(...hourRequests) : now;
  const reset = Math.floor((oldestRequest + hourWindowMs) / 1000);

  logInfo('[RateLimit] 用户限流检查通过', {
    subjectId,
    permissionLevel,
    minuteCount: minuteRequests.length + 1,
    hourCount: hourRequests.length + 1,
  });

  return {
    allowed: true,
    quota: { limit: rule.perUser.maxCallsPerHour, remaining, reset },
  };
}

// ========== 主入口函数 ==========

/**
 * 检查限流（按权限等级隔离）
 * @param params - 限流检查参数
 * @returns 限流检查结果
 */
export function checkRateLimit(params: RateLimitParams): RateLimitResult {
  const { subjectId, permissionLevel } = params;

  // 1. 获取该权限等级的限流规则
  const rule = getRateLimitRule(permissionLevel);

  if (!rule) {
    // 未配置该等级的限流规则
    if (isUnspecifiedLevelAllowed()) {
      logInfo('[RateLimit] 未配置等级，默认允许', { permissionLevel });
      return { allowed: true };
    } else {
      logWarn('[RateLimit] 未配置等级，默认拒绝', { permissionLevel });
      return {
        allowed: false,
        reason: `No rate limit configuration for permission level ${permissionLevel}`,
        errorCode: 'PERMISSION_LEVEL_NOT_CONFIGURED',
      };
    }
  }

  // 2. 检查全局限流（该等级所有用户合计）
  const globalResult = checkGlobalRateLimit(permissionLevel, rule);
  if (!globalResult.allowed) {
    return globalResult;
  }

  // 3. 检查用户级限流
  const userResult = checkUserRateLimit(subjectId, permissionLevel, rule);
  
  // 如果用户级检查通过，使用全局配额信息（更严格）
  if (userResult.allowed) {
    return {
      ...userResult,
      // 合并配额信息：取更严格的
      quota: globalResult.quota?.remaining! < (userResult.quota?.remaining ?? Infinity)
        ? globalResult.quota
        : userResult.quota,
    };
  }

  return userResult;
}

// ========== 统计与监控 ==========

/**
 * 获取当前限流统计信息
 */
export function getRateLimitStats(): {
  byLevel: Record<number, {
    global: { current: number; limit: number };
    users: number;
  }>;
} {
  const config = loadRateLimitConfig();
  const byLevel: Record<number, { global: { current: number; limit: number }; users: number }> = {};

  for (const rule of config.rules) {
    const level = rule.permissionLevel;
    const globalRequests = globalRequestsByLevel.get(level) || [];
    const userMap = userRequestsByLevel.get(level);

    byLevel[level] = {
      global: {
        current: cleanupOldRequests(globalRequests, 60 * 60 * 1000).length,
        limit: rule.global.maxCallsPerHour,
      },
      users: userMap?.size || 0,
    };
  }

  return { byLevel };
}

/**
 * 清理过期的请求记录（可定期调用）
 */
export function cleanupExpiredRecords(): void {
  const now = Date.now();
  const hourMs = 60 * 60 * 1000;

  // 清理全局记录
  for (const [level, requests] of globalRequestsByLevel.entries()) {
    const cleaned = cleanupOldRequests(requests, hourMs);
    if (cleaned.length === 0) {
      globalRequestsByLevel.delete(level);
    } else {
      globalRequestsByLevel.set(level, cleaned);
    }
  }

  // 清理用户记录
  for (const [level, userMap] of userRequestsByLevel.entries()) {
    for (const [browserId, requests] of userMap.entries()) {
      const cleaned = cleanupOldRequests(requests, hourMs);
      if (cleaned.length === 0) {
        userMap.delete(browserId);
      } else {
        userMap.set(browserId, cleaned);
      }
    }
    if (userMap.size === 0) {
      userRequestsByLevel.delete(level);
    }
  }

  logInfo('[RateLimit] 过期记录清理完成', {
    globalLevels: globalRequestsByLevel.size,
    userLevels: userRequestsByLevel.size,
  });
}
