import { logInfo, logWarn, logDebug, LogContext } from './logger';

// Hook 上下文
export interface HookContext {
  request: {
    browserId: string;
    modelId: string;
    messages: Array<{ role: string; content: string }>;
    parameters: Record<string, any>;
  };
  metadata: {
    requestId: string;
    timestamp: number;
    permissionLevel: number;
  };
}

// Hook 结果
export interface HookResult {
  action: 'proceed' | 'block' | 'modify';
  data?: any;
  error?: string;
}

// Hook 定义
export interface ApiHook {
  name: string;
  priority: number;
  handler: (context: HookContext) => Promise<HookResult | void>;
}

/**
 * 示例 Hook：记录请求日志
 */
const logRequestHook: ApiHook = {
  name: 'log-request',
  priority: 10,
  handler: async (context: HookContext) => {
    logInfo('[Hook] 请求日志记录', {
      hook: 'log-request',
      browserId: context.request.browserId,
      modelId: context.request.modelId,
      messageCount: context.request.messages.length,
      requestId: context.metadata.requestId,
      timestamp: context.metadata.timestamp
    });
    // 不返回结果，默认 proceed
  }
};

/**
 * 示例 Hook：检测敏感内容（占位，实际可在代理模块中实现）
 */
const sensitiveContentHook: ApiHook = {
  name: 'sensitive-content-check',
  priority: 20,
  handler: async (context: HookContext) => {
    logDebug('[Hook] 敏感内容检测（占位）', {
      hook: 'sensitive-content-check',
      requestId: context.metadata.requestId
    });
    // 这里可以添加实际的敏感内容检测逻辑
    // 如果检测到敏感内容，返回 { action: 'block', error: '...' }
    // 目前默认 proceed
  }
};

/**
 * Hook 注册表
 * 后续可以在代理模块中添加更多 Hook
 */
export const apiHooks: ApiHook[] = [
  logRequestHook,
  sensitiveContentHook
  // 可以在这里添加更多 Hook
];

/**
 * 执行所有 Hook（按优先级排序）
 * @param context - Hook 上下文
 * @returns 最终 Hook 结果（如果有任何 Hook 返回 block 或 modify）
 */
export async function executeHooks(context: HookContext): Promise<HookResult> {
  logDebug('[Hook] 开始执行 Hook 链', {
    requestId: context.metadata.requestId,
    hookCount: apiHooks.length
  });

  // 按优先级排序（数值越小，优先级越高）
  const sortedHooks = [...apiHooks].sort((a, b) => a.priority - b.priority);

  for (const hook of sortedHooks) {
    try {
      logDebug('[Hook] 执行 Hook', {
        hookName: hook.name,
        priority: hook.priority,
        requestId: context.metadata.requestId
      });

      const result = await hook.handler(context);

      // 如果 Hook 返回了结果
      if (result) {
        logInfo('[Hook] Hook 返回结果', {
          hookName: hook.name,
          action: result.action,
          requestId: context.metadata.requestId
        });

        // 如果是 block 或 modify，立即返回
        if (result.action === 'block' || result.action === 'modify') {
          return result;
        }
      }
    } catch (error) {
      logWarn('[Hook] Hook 执行失败', {
        hookName: hook.name,
        error: error instanceof Error ? error.message : String(error),
        requestId: context.metadata.requestId
      });
      // Hook 失败不阻止后续 Hook 执行
    }
  }

  // 所有 Hook 执行完成，默认 proceed
  logDebug('[Hook] 所有 Hook 执行完成，继续处理', {
    requestId: context.metadata.requestId
  });

  return { action: 'proceed' };
}

/**
 * 注册新的 Hook
 * @param hook - 要注册的 Hook
 */
export function registerHook(hook: ApiHook): void {
  apiHooks.push(hook);
  logInfo('[Hook] Hook 已注册', {
    hookName: hook.name,
    priority: hook.priority,
    totalHooks: apiHooks.length
  });
}

/**
 * 移除指定名称的 Hook
 * @param hookName - Hook 名称
 */
export function unregisterHook(hookName: string): boolean {
  const initialLength = apiHooks.length;
  const index = apiHooks.findIndex(h => h.name === hookName);
  if (index !== -1) {
    apiHooks.splice(index, 1);
    logInfo('[Hook] Hook 已移除', {
      hookName,
      remainingHooks: apiHooks.length
    });
    return true;
  }
  return false;
}
