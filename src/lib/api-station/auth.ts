import { logInfo, logError } from './logger';
import { resolveUserPermissions } from './userPermissions';
import { verifyProxyKey } from './proxyKey';
import { getVisitorSessionFromRequest, hashVisitorId } from './visitorSession';
import { parseUnifiedToken } from './authExtractor';
import { verifyAccountToken } from '@/lib/account-client';
import type { ProxyKeyPayload, ResolvedPermissionProfile, SubjectType } from '@/types/apiStationAuth';
import { GUEST_PERMISSION_LEVEL } from '@/types/apiStationAuth';

export interface AuthResult {
  success: boolean;
  subjectType?: SubjectType;
  subjectId?: string;
  userRef?: string;
  permissionLevel?: number;
  permissionProfile?: ResolvedPermissionProfile;
  keyPayload?: ProxyKeyPayload;
  proof?: string;
  error?: string;
  errorCode?: string;
}

export interface ChallengeAuthParams {
  token: string | null;
  answer: string | null;
  nonce: number | null;
}

async function validateRequestBinding(
  payload: ProxyKeyPayload,
  request: Request | undefined,
): Promise<{ success: true } | { success: false; error: string; errorCode: string }> {
  if (payload.version !== 'v2' || payload.subjectType !== 'guest') {
    return { success: true };
  }

  if (!request) {
    return {
      success: false,
      error: 'Missing request context for session-bound proxy key',
      errorCode: 'MISSING_REQUEST_CONTEXT',
    };
  }

  const visitorSession = await getVisitorSessionFromRequest(request);
  if (!visitorSession) {
    return {
      success: false,
      error: 'Missing visitor session',
      errorCode: 'MISSING_VISITOR_SESSION',
    };
  }

  if (visitorSession.visitorId !== payload.subjectId) {
    return {
      success: false,
      error: 'Visitor session mismatch',
      errorCode: 'VISITOR_SESSION_MISMATCH',
    };
  }

  if (visitorSession.sessionId !== payload.sessionId) {
    return {
      success: false,
      error: 'Visitor session binding mismatch',
      errorCode: 'VISITOR_SESSION_BINDING_MISMATCH',
    };
  }

  const expectedVisitorIdHash = await hashVisitorId(visitorSession.visitorId);
  if (payload.sessionBinding.visitorIdHash !== expectedVisitorIdHash) {
    return {
      success: false,
      error: 'Visitor session hash mismatch',
      errorCode: 'VISITOR_SESSION_HASH_MISMATCH',
    };
  }

  return { success: true };
}

export async function authenticateProxyKey(key: string | null, request?: Request): Promise<AuthResult> {
  if (!key) {
    logError('[Auth] 鉴权失败: proxy key 缺失');
    return {
      success: false,
      error: 'Missing proxy key',
      errorCode: 'MISSING_PROXY_KEY',
    };
  }

  const verification = await verifyProxyKey(key);
  if (!verification.success) {
    logError('[Auth] 鉴权失败: proxy key 无效', verification.error, {
      errorCode: verification.errorCode,
    });
    return {
      success: false,
      error: verification.error,
      errorCode: verification.errorCode,
    };
  }

  const bindingResult = await validateRequestBinding(verification.payload!, request);
  if (!bindingResult.success) {
    logError('[Auth] 鉴权失败: proxy key 会话绑定无效', bindingResult.error, {
      errorCode: bindingResult.errorCode,
    });
    return {
      success: false,
      error: bindingResult.error,
      errorCode: bindingResult.errorCode,
    };
  }

  const permissionProfile = await resolveUserPermissions({
    subjectType: verification.subjectType!,
    subjectId: verification.subjectId!,
    userRef: verification.userRef ?? null,
  });

  const subjectPreview = `${verification.subjectId!.slice(0, 8)}...`;

  logInfo('[Auth] Proxy key 鉴权成功', {
    subjectType: verification.subjectType,
    subjectPreview,
    permissionLevel: permissionProfile.permissionLevel,
    role: permissionProfile.role,
    source: permissionProfile.source,
  });

  return {
    success: true,
    subjectType: verification.subjectType,
    subjectId: verification.subjectId,
    userRef: verification.userRef,
    permissionLevel: permissionProfile.permissionLevel,
    permissionProfile,
    keyPayload: verification.payload,
    proof: verification.proof,
  };
}

export function checkModelPermission(
  userPermissionLevel: number,
  modelPermissionLevel: number,
): boolean {
  return userPermissionLevel >= modelPermissionLevel;
}

/**
 * 统一 token 鉴权
 * 
 * 流程：
 * 1. 解析统一 token 得到 proxyKey 和 accountToken
 * 2. 验证 proxyKey（签名、有效期、session 绑定）
 * 3. 验证 accountToken（调用账户服务）获取权限等级
 * 4. 返回鉴权结果
 * 
 * @param unifiedToken - 统一 token，格式: <proxyKey>::<accountToken>
 * @param request - 请求对象（用于 session 绑定验证）
 * @returns 鉴权结果
 */
export async function authenticateUnifiedToken(
  unifiedToken: string | null,
  request?: Request,
): Promise<AuthResult> {
  // 1. 必须有 token
  if (!unifiedToken) {
    logError('[Auth] 鉴权失败: token 缺失');
    return {
      success: false,
      error: 'Missing token',
      errorCode: 'MISSING_TOKEN',
    };
  }

  // 2. 解析统一 token
  const { proxyKey, accountToken } = parseUnifiedToken(unifiedToken);

  // 3. 必须有 proxyKey
  if (!proxyKey) {
    logError('[Auth] 鉴权失败: proxy key 缺失');
    return {
      success: false,
      error: 'Missing proxy key',
      errorCode: 'MISSING_PROXY_KEY',
    };
  }

  // 4. 验证 proxyKey（签名、有效期）
  const verification = await verifyProxyKey(proxyKey);
  if (!verification.success) {
    logError('[Auth] 鉴权失败: proxy key 无效', verification.error, {
      errorCode: verification.errorCode,
    });
    return {
      success: false,
      error: verification.error,
      errorCode: verification.errorCode,
    };
  }

  // 5. 验证 session 绑定（浏览器验证）
  const bindingResult = await validateRequestBinding(verification.payload!, request);
  if (!bindingResult.success) {
    logError('[Auth] 鉴权失败: proxy key 会话绑定无效', bindingResult.error, {
      errorCode: bindingResult.errorCode,
    });
    return {
      success: false,
      error: bindingResult.error,
      errorCode: bindingResult.errorCode,
    };
  }

  // 6. 确定权限等级
  let permissionLevel = GUEST_PERMISSION_LEVEL;
  let userId: string | undefined;

  if (accountToken) {
    // 有账户 token → 调用账户服务验证
    const accountResult = await verifyAccountToken(accountToken);
    if (accountResult.success) {
      permissionLevel = accountResult.permissionLevel;
      userId = accountResult.userId;
    }
    // 验证失败 → 保持游客等级
  }

  // 7. 构建权限配置
  const subjectPreview = `${verification.subjectId!.slice(0, 8)}...`;
  const subjectType: SubjectType = userId ? 'user' : 'guest';

  const permissionProfile: ResolvedPermissionProfile = {
    subjectType,
    subjectId: verification.subjectId!,
    userRef: verification.userRef ?? null,
    permissionLevel,
    role: userId ? 'member' : 'guest',
    isAuthenticated: !!userId,
    source: userId ? 'account-hook' : 'guest-fallback',
  };

  logInfo('[Auth] 统一 token 鉴权成功', {
    subjectType,
    subjectPreview,
    permissionLevel,
    hasAccountToken: !!accountToken,
    isAuthenticated: !!userId,
  });

  return {
    success: true,
    subjectType,
    subjectId: verification.subjectId,
    userRef: verification.userRef,
    permissionLevel,
    permissionProfile,
    keyPayload: verification.payload,
    proof: verification.proof,
  };
}
