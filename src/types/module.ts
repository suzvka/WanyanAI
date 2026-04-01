import type { AnalysisControlsConfig, SiteConfig } from '@/server/config/types';

/**
 * 容器配置
 */
export type ContainerConfig = {
  /** 容器类型标识 */
  type: string;
  /** 容器参数（根据类型不同而不同） */
  params?: Record<string, unknown>;
};

/**
 * text-blocks 容器专用参数
 */
export type TextBlocksContainerParams = {
  /** 容器唯一标识（用于数据关联） */
  id: string;
  /** 显示标题（可选，不传则使用 id 作为标题） */
  title?: string;
  /** 副标题（可选，显示在主标题下方） */
  subtitle?: string;
  /**
   * 提示词（可选，对用户不可见）
   * 仅用于生成用户文本元数据时在对应容器属性中增加一个字符串字段
   * 为空时不向属性中添加该字段
   */
  prompt?: string;
  /** 默认是否展开 */
  defaultExpanded?: boolean;
  /** 初始块数量 */
  initialBlockCount?: number;
  /**
   * 最大文本块数量（可选）
   * - 未配置或为 undefined 时：无限制（默认）
   * - 配置后：达到上限时隐藏"添加更多"按钮，不影响已有块
   */
  maxBlockCount?: number;
};

/**
 * 模块注册配置（main.json）
 */
export type ModuleManifest = {
  /** 模块唯一标识 */
  id: string;
  /** 显示名称 */
  name: string;
  /** 简短描述 */
  description?: string;
  /** 路由路径 */
  route: string;
  /** 页面容器配置（按顺序渲染） */
  containers: ContainerConfig[];
  /** 输出模式标识 */
  outputMode: string;
  /** 侧栏配置 */
  sidebar: {
    /** 是否在侧栏显示 */
    enabled: boolean;
    /** 图标名称（Lucide icon） */
    icon: string;
    /** 排序权重 */
    order: number;
  };
  /**
   * @deprecated 已废弃，由 containers 替代
   * 功能配置
   */
  features?: {
    textBlocks: boolean;
    fileUpload: boolean;
    annotations: boolean;
  };
};

/**
 * 模块完整配置
 */
export type ModuleConfig = {
  /** 配置来源 */
  source: 'published' | 'fallback';
  /** 模块注册信息 */
  manifest: ModuleManifest;
  /** 页面文案配置 */
  site: SiteConfig;
  /** 分析控制配置 */
  analysisControls: AnalysisControlsConfig;
};

/**
 * 模块注册表
 */
export type ModuleRegistry = {
  /** 所有模块列表 */
  modules: ModuleConfig[];
  /** 根据 ID 获取模块 */
  getModuleById: (id: string) => ModuleConfig | undefined;
  /** 根据路由获取模块 */
  getModuleByRoute: (route: string) => ModuleConfig | undefined;
};

/**
 * 容器验证错误
 */
export type ContainerValidationError = {
  /** 错误字段路径 */
  field: string;
  /** 错误消息 */
  message: string;
};
