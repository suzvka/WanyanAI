'use client';

import { useCallback, useState } from 'react';

/** 用户信息 */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
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

/** 从 sessionStorage 读取初始状态的工厂函数（在 useState 初始化器中调用，避免 effect 中 setState） */
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

export function useAuth() {
  const [state, setState] = useState<AuthState>(readInitialState);

  /** 登录成功后保存状态 */
  const login = useCallback(
    (token: string, user: AuthUser, claims?: Record<string, unknown>) => {
      const membership = parseMembershipClaims(claims);
      sessionStorage.setItem(STORAGE_KEYS.token, token);
      sessionStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
      if (membership) {
        sessionStorage.setItem(STORAGE_KEYS.membership, JSON.stringify(membership));
      }
      setState({
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
    setState((prev) => ({ ...prev, membership }));
  }, []);

  /** 登出 */
  const logout = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEYS.token);
    sessionStorage.removeItem(STORAGE_KEYS.user);
    sessionStorage.removeItem(STORAGE_KEYS.membership);
    setState({
      loaded: true,
      loggedIn: false,
      user: null,
      stationToken: null,
      membership: null,
    });
  }, []);

  return { ...state, login, updateMembership, logout };
}