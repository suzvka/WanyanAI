'use client';

import { useCallback, useSyncExternalStore } from 'react';

/** 用户信息 */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  // 可选：平台认证 userinfo 不返回角色，角色由 membershipLevel 派生（见 parseMembershipClaims）
  role?: string;
}

/** 会员信息 */
export interface MembershipInfo {
  level: string;
  permissionLevel: number;
  expiresAt: string;
}

interface AuthState {
  loaded: boolean;
  loggedIn: boolean;
  user: AuthUser | null;
  stationToken: string | null;
  membership: MembershipInfo | null;
}

const STORAGE_KEYS = {
  user: 'station_user',
  token: 'station_token',
  membership: 'station_membership',
} as const;

function parseMembershipClaims(claims: Record<string, unknown> | undefined): MembershipInfo | null {
  if (!claims?.membershipLevel) return null;
  const level = claims.membershipLevel as string;
  const permissionMap: Record<string, number> = {
    free: 1,
    vip: 2,
    svip: 3,
    admin: 99,
  };
  return {
    level,
    permissionLevel: permissionMap[level] ?? 1,
    expiresAt: (claims.expiresAt as string) ?? '',
  };
}

/** 从 sessionStorage 读取登录状态（SSR 无 window 时返回占位状态） */
function readInitialState(): AuthState {
  if (typeof window === 'undefined') {
    return { loaded: false, loggedIn: false, user: null, stationToken: null, membership: null };
  }

  const token = sessionStorage.getItem(STORAGE_KEYS.token);
  const userRaw = sessionStorage.getItem(STORAGE_KEYS.user);
  const membershipRaw = sessionStorage.getItem(STORAGE_KEYS.membership);

  if (token && userRaw) {
    try {
      const user = JSON.parse(userRaw) as AuthUser;
      const membership = membershipRaw
        ? (JSON.parse(membershipRaw) as MembershipInfo)
        : null;
      return {
        loaded: true,
        loggedIn: true,
        user,
        stationToken: token,
        membership,
      };
    } catch {
      // 数据损坏，清除
      sessionStorage.removeItem(STORAGE_KEYS.token);
      sessionStorage.removeItem(STORAGE_KEYS.user);
      sessionStorage.removeItem(STORAGE_KEYS.membership);
    }
  }

  return { loaded: true, loggedIn: false, user: null, stationToken: null, membership: null };
}

/**
 * 登录状态以 useSyncExternalStore 暴露：
 * - SSR/RSC 渲染使用 serverSnapshot（loaded:false），客户端水合后立即用 getSnapshot
 *   重新读取 sessionStorage，与服务端快照不一致时由 React 自动修正渲染，
 *   无需 useEffect 手动 setState。
 * - getSnapshot 返回缓存的稳定引用，写入路径（login/logout/updateMembership）
 *   更新缓存并通知订阅者。
 */
const SSR_STATE: AuthState = {
  loaded: false,
  loggedIn: false,
  user: null,
  stationToken: null,
  membership: null,
};

let cachedState: AuthState | null = null;

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): AuthState {
  if (cachedState === null) {
    cachedState = readInitialState();
  }
  return cachedState;
}

function getServerSnapshot(): AuthState {
  return SSR_STATE;
}

function commit(next: AuthState): void {
  cachedState = next;
  listeners.forEach((listener) => listener());
}

export function useAuth() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  /** 登录成功后保存状态 */
  const login = useCallback(
    (token: string, user: AuthUser, claims?: Record<string, unknown>) => {
      const membership = parseMembershipClaims(claims);
      sessionStorage.setItem(STORAGE_KEYS.token, token);
      sessionStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
      if (membership) {
        sessionStorage.setItem(STORAGE_KEYS.membership, JSON.stringify(membership));
      }
      commit({
        loaded: true,
        loggedIn: true,
        user,
        stationToken: token,
        membership,
      });
    },
    [],
  );

  /** 更新会员信息 */
  const updateMembership = useCallback((membership: MembershipInfo) => {
    sessionStorage.setItem(STORAGE_KEYS.membership, JSON.stringify(membership));
    commit({ ...(cachedState ?? readInitialState()), membership });
  }, []);

  /** 登出：先服务端吊销 station token（失败不阻塞本地清理），再清除本地状态 */
  const logout = useCallback(() => {
    const token = sessionStorage.getItem(STORAGE_KEYS.token);
    if (token) {
      // fire-and-forget：不阻塞本地清理，失败降级为仅本地登出
      fetch('/api/v1/auth/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      }).catch(() => {});
    }
    sessionStorage.removeItem(STORAGE_KEYS.token);
    sessionStorage.removeItem(STORAGE_KEYS.user);
    sessionStorage.removeItem(STORAGE_KEYS.membership);
    commit({
      loaded: true,
      loggedIn: false,
      user: null,
      stationToken: null,
      membership: null,
    });
  }, []);

  return { ...state, login, updateMembership, logout };
}
