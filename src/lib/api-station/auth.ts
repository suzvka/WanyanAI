import { logInfo, logError } from './logger';
import { resolveUserPermissions } from './userPermissions';
import { verifyProxyKey } from './proxyKey';
import { getVisitorSessionFromRequest, hashVisitorId } from './visitorSession';
import type { ProxyKeyPayload, ResolvedPermissionProfile, SubjectType } from '@/types/apiStationAuth';

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
