/**
 * 会员策略注册表（Membership Strategy Registry）
 *
 * 「往 token 上绑定哪些内容」的可配置策略层：
 * - 每个策略声明：目标等级 + 基于当前 claims 计算新 claims 的方式 + 适用条件；
 * - token 绑定接口（/api/v1/membership/*）只负责「查策略 → 执行策略 → 换发 token」，
 *   不硬编码任何「升一级 / 降一级」的业务动作；
 * - 新增一个商品/按钮 = 在这里注册一条策略（前端卡片由 /api/v1/membership/actions 自动下发渲染）。
 */

import { MEMBERSHIP_TO_PERMISSION } from '@/lib/auth-center/types';

/** 会员策略 */
export interface MembershipStrategy {
  /** 策略唯一标识（按钮/商品卡片与之一一绑定） */
  id: string;
  /** 展示名称（卡片标题） */
  label: string;
  /** 展示说明（卡片描述） */
  description: string;
  /** 策略产出的目标会员等级（用于响应中的 permissionLevel 计算） */
  targetLevel: string;
  /** 应用策略：基于当前 claims 计算换发后的新 claims（token 绑定内容的唯一出口） */
  apply: (currentClaims: Record<string, unknown>) => Record<string, unknown>;
  /** 当前等级下是否可执行（升级/降级/还原的适用性均由策略自行声明，无全局硬编码） */
  isApplicable: (currentLevel: string) => boolean;
}

// ============ 策略注册表 ============

const STRATEGIES: MembershipStrategy[] = [
  {
    id: 'upgrade-vip',
    label: '升级到 VIP',
    description: '解锁高级模型与优先队列',
    targetLevel: 'vip',
    apply: (claims) => ({ ...claims, membershipLevel: 'vip' }),
    isApplicable: (level) => level === 'free',
  },
  {
    id: 'upgrade-svip',
    label: '升级到 SVIP',
    description: '解锁全部模型与最高优先级',
    targetLevel: 'svip',
    apply: (claims) => ({ ...claims, membershipLevel: 'svip' }),
    isApplicable: (level) => level === 'vip',
  },
  {
    id: 'reset-vip',
    label: '还原 VIP',
    description: '恢复为免费用户（permissionLevel = 1）',
    targetLevel: 'free',
    apply: (claims) => ({ ...claims, membershipLevel: 'free' }),
    isApplicable: (level) => level === 'vip' || level === 'svip',
  },
];

// ============ 查询函数 ============

/** 按 id 查询策略 */
export function getMembershipStrategy(id: string): MembershipStrategy | undefined {
  return STRATEGIES.find((s) => s.id === id);
}

/** 获取当前等级下可执行的策略列表（保持注册顺序） */
export function getApplicableStrategies(currentLevel: string): MembershipStrategy[] {
  return STRATEGIES.filter((s) => s.isApplicable(currentLevel));
}

/** 策略 id → 该策略下可执行的全部 id（供接口校验） */
export function isMembershipAction(id: string): boolean {
  return STRATEGIES.some((s) => s.id === id);
}

/** 目标等级 → 权限等级（复用鉴权中心映射） */
export function getPermissionLevelFor(level: string): number {
  return MEMBERSHIP_TO_PERMISSION[level] ?? 1;
}
