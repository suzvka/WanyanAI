import {
  GUEST_PERMISSION_LEVEL,
  type ResolvedPermissionProfile,
  type SubjectType,
} from '@/types/apiStationAuth';

export interface PermissionSubject {
  subjectId: string;
  subjectType: SubjectType;
  userRef: string | null;
}

export type UserPermissionResolver = (
  subject: PermissionSubject,
) => Promise<ResolvedPermissionProfile | null> | ResolvedPermissionProfile | null;

let customResolver: UserPermissionResolver | null = null;

export function registerUserPermissionResolver(resolver: UserPermissionResolver | null) {
  customResolver = resolver;
}

export async function resolveUserPermissions(subject: PermissionSubject): Promise<ResolvedPermissionProfile> {
  const resolved = customResolver ? await customResolver(subject) : null;
  if (resolved) {
    return resolved;
  }

  return {
    subjectType: subject.subjectType,
    subjectId: subject.subjectId,
    userRef: subject.userRef,
    permissionLevel: GUEST_PERMISSION_LEVEL,
    role: 'guest',
    isAuthenticated: false,
    source: 'guest-fallback',
  };
}
