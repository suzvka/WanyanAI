/**
 * 控件模块 - 核心类型定义
 *
 * 架构原则：
 * - 配置模块与容器模块解耦，靠上层组合使用
 * - 控件模块内部逻辑自由实现
 * - 框架透传配置，控件自行解析
 * - 编译时机：提交时一次性组装提示词
 */

// ============================================================================
// 控件配置结构
// ============================================================================

/**
 * 原始控件项（扁平结构中单个控件）
 *
 * 每个控件自己声明类型，框架根据类型分发到对应模块
 */
export interface RawControlItem {
  /** 控件唯一标识 */
  id: string;
  /** 控件类型标识 */
  type: string;
  /** 是否启用 */
  enabled?: boolean;
  /** 控件标题 */
  title?: string;
  /** 其他配置（模块自由定义） */
  [key: string]: unknown;
}

/**
 * 控件配置（支持两种结构）
 *
 * 扁平结构（推荐）：controls: [RawControlItem, ...]
 * 分组结构（兼容）：controls: { "select": [...], "slider": [...] }
 */
export type ControlsConfig = RawControlItem[] | Record<string, RawControlItem[]>;

// ============================================================================
// 控件定义
// ============================================================================

/**
 * 控件定义 - 容器渲染所需
 *
 * 模块根据配置生成控件定义，框架将其传递给容器渲染
 */
export interface ControlDefinition {
  /** 控件唯一标识 */
  id: string;
  /** 控件类型标识 */
  type: string;
  /** 控件标题 */
  title?: string;
  /** 控件描述 */
  description?: string;
  /**
   * 初始值（由控件模块在 getDefinitions 中计算）
   *
   * 框架在初始化 controlSelections 时直接使用此值，
   * 无需了解控件类型的内部细节（如 defaultSelected 如何映射）。
   * 未定义时表示无默认值。
   */
  initialValue?: string;
  /** 控件数据（模块自由定义格式） */
  data: unknown;
}

// ============================================================================
// 编译结果
// ============================================================================

/**
 * 编译结果
 *
 * 所有控件模块必须返回固定格式的编译结果
 */
export interface CompileResult {
  /** 生成的提示词文本 */
  instruction: string;
}

/**
 * 合并函数类型
 *
 * 框架使用此函数将多个控件的编译结果合并为最终提示词
 */
export type MergerFn = (results: CompileResult[]) => CompileResult;

// ============================================================================
// 控件模块接口
// ============================================================================

/**
 * 控件模块接口
 *
 * 每个控件类型必须实现此接口。
 *
 * 类型安全设计：
 * - extractConfig 保留 unknown 入参（接收原始 JSON，是类型边界）
 * - getDefinitions / compile 使用 RawControlItem（框架已标准化后的强类型）
 * - data 字段保留 unknown（各模块自定义格式，由渲染器解释）
 */
export interface ControlModule {
  /** 控件类型唯一标识 */
  id: string;
  /** 控件类型显示名称 */
  name: string;

  /**
   * 从原始配置提取本模块相关的控件项
   *
   * 这是唯一的 unknown 边界：接收 main.json 的原始 JSON 值，
   * 返回属于本类型的控件项数组。
   *
   * @param raw 原始配置（main.json 中的 controls 字段值）
   * @returns 提取后的控件项数组，无匹配则返回 null
   */
  extractConfig(raw: unknown): RawControlItem[] | null;

  /**
   * 生成控件定义列表
   *
   * 框架已将配置标准化为 RawControlItem[] 后调用此方法，
   * 每个数组元素保证 type 字段与本模块 id 匹配。
   *
   * @param config 属于本类型的控件项数组
   * @returns 控件定义数组（含 initialValue）
   */
  getDefinitions(config: RawControlItem[]): ControlDefinition[];

  /**
   * 编译用户选择为提示词片段
   *
   * 框架标准化后逐项调用，config 为单个控件项。
   *
   * @param config 单个控件项（type 已匹配本模块）
   * @param selections 用户选择 { controlId: value }
   * @returns 编译结果（提示词文本）
   */
  compile(config: RawControlItem, selections: Record<string, string>): CompileResult;
}

// ============================================================================
// 注册表接口
// ============================================================================

/**
 * 控件注册表接口
 */
export interface ControlRegistry {
  /**
   * 注册控件模块
   */
  register(module: ControlModule): void;

  /**
   * 获取控件模块
   */
  get(id: string): ControlModule | undefined;

  /**
   * 获取所有已注册的控件类型 ID
   */
  getIds(): string[];

  /**
   * 批量编译
   *
   * 遍历所有已注册的控件模块，收集编译结果并合并
   * @param rawConfig 原始配置（main.json 中的 controls 字段）
   * @param selections 用户选择
   * @returns 合并后的编译结果
   */
  compileAll(
    rawConfig: unknown,
    selections: Record<string, string>,
  ): CompileResult;

  /**
   * 设置合并策略
   */
  setMerger(fn: MergerFn): void;

  /**
   * 获取合并策略
   */
  getMerger(): MergerFn;

  /**
   * 批量生成控件定义
   *
   * 根据原始配置，分发到各控件模块的 getDefinitions() 方法，
   * 收集并返回所有控件的定义（含 initialValue）。
   * 框架在模块加载时调用此方法，将结果传递给前端用于初始化。
   *
   * @param rawConfig 原始配置（main.json 中的 controls 字段）
   * @returns 控件定义数组（扁平化，按配置顺序排列）
   */
  getDefinitions(rawConfig: unknown): ControlDefinition[];
}

// ============================================================================
// 控件配置类型（main.json 中的控件配置结构）
// ============================================================================
