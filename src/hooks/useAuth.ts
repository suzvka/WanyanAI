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

/**
 * 平台单点登出 state 的暂存 key（登出发起时写入，/auth/logout-callback 校验后清除）。
 * 导出供登出回调页复用，避免两处硬编码不一致。
 */
export const LOGOUT_STATE_KEY = 'logout_state';

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

  /**
   * 无感轮换登录凭证（token rotation）。
   *
   * 服务端在会员升级等场景会吊销旧 token 并换发新 token（vip 等级与 token 绑定）。
   * 调用本方法将新 token 与会员信息同步到 sessionStorage 与内存缓存并通知订阅者，
   * 使 useAuth().stationToken 立即切换到新 token，后续请求全程无感使用新凭证，
   * 避免因旧 token 已失效导致登录态丢失。
   */
  const rotateToken = useCallback(
    (patch: { token: string; membership: MembershipInfo | null }) => {
      const current = cachedState ?? readInitialState();
      sessionStorage.setItem(STORAGE_KEYS.token, patch.token);
      if (patch.membership) {
        sessionStorage.setItem(STORAGE_KEYS.membership, JSON.stringify(patch.membership));
      } else {
        sessionStorage.removeItem(STORAGE_KEYS.membership);
      }
      commit({
        ...current,
        loggedIn: true,
        stationToken: patch.token,
        membership: patch.membership,
      });
    },
    [],
  );

  /**
   * 登出（单点登出联动）：
   *   1. 吊销本站 station token（等待完成，失败降级为仅本地登出）
   *   2. 清除本地登录态（sessionStorage + 内存缓存）
   *   3. 跳转平台登出端点销毁平台会话，否则平台域 cookie 仍在，
   *      用户下次仍可静默免密登录，登出语义不成立
   */
  const logout = useCallback(async () => {
    // 1. 吊销本站 station token（等待完成，保证跳转前吊销已落库）
    const token = sessionStorage.getItem(STORAGE_KEYS.token);
    if (token) {
      try {
        await fetch('/api/v1/auth/revoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
      } catch {
        // 网络异常不阻塞本地清理（保留原 fire-and-forget 的降级语义）
      }
    }

    // 2. 清除本地登录态（无论服务端吊销成败）
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

    // 3. 平台单点登出：浏览器跳转到平台登出端点（清平台域会话必须由浏览器带 cookie 发起）
    try {
      const res = await fetch('/api/v1/config');
      if (!res.ok) throw new Error('config unavailable');
      const cfg = (await res.json()) as { platformAuthUrl?: string; oauthClientId?: string };
      if (!cfg.platformAuthUrl || !cfg.oauthClientId) {
        throw new Error('platform auth not configured');
      }

      const state = crypto.randomUUID();
      sessionStorage.setItem(LOGOUT_STATE_KEY, state);

      const redirectUri = `${window.location.origin}/auth/logout-callback`;
      const logoutUrl =
        `${cfg.platformAuthUrl}/api/oauth/logout` +
        `?client_id=${encodeURIComponent(cfg.oauthClientId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&state=${encodeURIComponent(state)}`;
      window.location.href = logoutUrl;
    } catch {
      // 平台认证未配置或获取失败：降级为仅本地登出，回首页
      window.location.href = '/';
    }
  }, []);

  return { ...state, login, updateMembership, rotateToken, logout };
}
