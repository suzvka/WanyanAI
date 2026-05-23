// Hook 上下文
export interface HookContext {
  request: {
    browserId: string | null;
    modelId: string;
    messages: Array<{ role: string; content: string }>;
    parameters: Record<string, unknown>;
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
  data?: unknown;
  error?: string;
}

// Hook 定义
export interface ApiHook {
  name: string;
  priority: number;
  handler: (context: HookContext) => Promise<HookResult | void>;
}

/**
 * 执行所有 Hook
 *
 * 当前无可注册 Hook，直接放行。
 * 后续如需添加预处理逻辑，在此函数中实现。
 */
export async function executeHooks(_context: HookContext): Promise<HookResult> {
  return { action: 'proceed' };
}
