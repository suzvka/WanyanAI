import { logInfo, logError, LogContext } from './logger';

// 鉴权结果接口
export interface AuthResult {
  success: boolean;
  browserId?: string;
  permissionLevel?: number;
  error?: string;
  errorCode?: string;
}

// 鉴权上下文
export interface AuthContext {
  browserId: string | null;
}

/**
 * 验证浏览器 ID 格式（UUID v4）
 */
function isValidBrowserId(browserId: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(browserId);
}

/**
 * 鉴权浏览器访问
 * @param browserId - 浏览器 ID（从请求头 X-Browser-Id 获取）
 * @returns 鉴权结果
 */
export function authenticateBrowser(browserId: string | null): AuthResult {
  const context: AuthContext = { browserId };

  // 1. 检查是否提供了浏览器 ID
  if (!browserId) {
    const error = 'Missing browser ID';
    logError('[Auth] 鉴权失败: 浏览器 ID 缺失', null, { browserId: undefined });
    return {
      success: false,
      error,
      errorCode: 'MISSING_BROWSER_ID'
    };
  }

  // 2. 验证 UUID 格式
  if (!isValidBrowserId(browserId)) {
    const error = 'Invalid browser ID format';
    logError('[Auth] 鉴权失败: 浏览器 ID 格式无效', null, { browserId });
    return {
      success: false,
      error,
      errorCode: 'INVALID_BROWSER_ID'
    };
  }

  // 3. 鉴权通过，返回游客权限（权限等级为 1）
  logInfo('[Auth] 鉴权成功', {
    browserId,
    permissionLevel: 1
  });

  return {
    success: true,
    browserId,
    permissionLevel: 1 // 游客默认权限为 1
  };
}

/**
 * 检查用户是否有权限使用指定模型
 * @param userPermissionLevel - 用户权限等级
 * @param modelPermissionLevel - 模型所需权限等级
 * @returns 是否有权限
 */
export function checkModelPermission(
  userPermissionLevel: number,
  modelPermissionLevel: number
): boolean {
  return userPermissionLevel >= modelPermissionLevel;
}
