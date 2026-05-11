export const GUEST_PERMISSION_LEVEL = 1;

export type PermissionRole = 'guest' | 'member' | 'admin';
export type SubjectType = 'guest' | 'user';

export interface ProxyKeyPayloadV1 {
  version: 'v1';
  userRef: string;
  sessionId: string | null;
  issuedAt: number;
  expiresAt: number;
  permissionHint: PermissionRole;
  powSeed?: string | null;
}

export interface ProxyKeySessionBinding {
  visitorIdHash: string;
}

export interface ProxyKeyPayloadV2 {
  version: 'v2';
  subjectType: SubjectType;
  subjectId: string;
  userRef: string | null;
  sessionId: string;
  sessionBinding: ProxyKeySessionBinding;
  issuedAt: number;
  expiresAt: number;
  permissionHint: PermissionRole;
  keyUse: 'model_proxy';
}

export type ProxyKeyPayload = ProxyKeyPayloadV1 | ProxyKeyPayloadV2;

export interface ProxyKeyVerificationResult {
  success: boolean;
  subjectType?: SubjectType;
  subjectId?: string;
  userRef?: string;
  sessionId?: string | null;
  proof?: string;
  payload?: ProxyKeyPayload;
  error?: string;
  errorCode?: string;
}

export interface ResolvedPermissionProfile {
  subjectType: SubjectType;
  subjectId: string;
  userRef: string | null;
  permissionLevel: number;
  role: PermissionRole;
  isAuthenticated: boolean;
  source: 'guest-fallback' | 'account-hook';
}
