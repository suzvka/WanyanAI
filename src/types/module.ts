import type { ControlDefinition } from '@/features/controls';

import type { SiteConfig } from '@/server/config/types';

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

export type PageModuleEntry = {
  /** 是否暴露为功能页面入口 */
  enabled: boolean;
  /** 排序权重（仅服务端使用） */
  order: number;
  /** 图标名称（仅内部配置使用） */
  icon?: string;
};

/**
 * 页面模块注册配置（main.json）
 */
export type PageModuleManifest = {
  /** 页面 slug（公开标识） */
  slug: string;
  /** 页面标题（公开字段） */
  title: string;
  /** 页面描述（公开字段） */
  description?: string;
  /** 路由路径（内部配置） */
  route: string;
  /** 页面容器配置（按顺序渲染） */
  containers: ContainerConfig[];
  /** 输出模式标识 */
  outputMode: string;
  /** 页面入口配置（内部配置） */
  entry: PageModuleEntry;
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
 * 控件配置
 *
 * main.json 中的 controls 字段类型
 * 结构为 { [controlType]: controlConfig }
 * 例如：{ "select": { "groups": [...] } }
 */
export type ControlItemBase = {
  id: string;
  title?: string;
  enabled?: boolean;
  type: string;
};

export type SelectControlItem = ControlItemBase & {
  type: 'select';
  options: Array<{
    value: string;
    label: string;
    enabled?: boolean;
    promptText?: string;
  }>;
};

/**
 * 多选控件配置
 */
export type MultiSelectControlItem = ControlItemBase & {
  type: 'multi-select';
  /** 控件级提示词 */
  promptText: string;
  /** 最大可选择数量，0 或不填表示不限制 */
  maxSelections?: number;
  options: Array<{
    label: string;
    promptText: string;
    /** 是否默认选中 */
    defaultSelected?: boolean;
  }>;
};

export type ControlConfig = SelectControlItem | MultiSelectControlItem;

/**
 * 控件配置（数组结构，每个控件有自己的 type 字段标识类型）
 */
export type ControlsConfig = ControlConfig[];

/**
 * 页面模块完整配置
 */
export type PageModuleConfig = {
  /** 配置来源 */
  source: 'published';
  /** 模块注册信息 */
  manifest: PageModuleManifest;
  /** 页面文案配置 */
  site: SiteConfig;
  /** 控件配置（原始 JSON 数据，编译时使用） */
  controls: ControlsConfig;
  /**
   * 控件定义（由控件模块 getDefinitions() 预计算）
   *
   * 含 initialValue 字段，前端 PageContext 直接读取以初始化 controlSelections，
   * 无需了解控件类型内部细节（符合开闭原则）。
   */
  controlDefinitions: ControlDefinition[];
};

/**
 * 页面模块对外公开元数据
 */
export type PageModulePublicMeta = {
  /** 页面 slug（公开字段） */
  slug: string;
  /** 页面标题（公开字段） */
  title: string;
  /** 页面描述（公开字段） */
  description?: string;
};

/**
 * 页面模块注册表
 */
export type PageModuleRegistry = {
  /** 所有完整页面模块列表 */
  modules: PageModuleConfig[];
  /** 对外公开入口列表 */
  publicEntries: PageModulePublicMeta[];
  /** 根据 slug 获取模块 */
  getModuleBySlug: (slug: string) => PageModuleConfig | undefined;
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
