/**
 * 中转站模块类型定义
 * 
 * 中转站（Station）是自包含的 LLM 转发器，仅负责将请求转发到具体的模型服务。
 * 权限解析与限流由主入口（src/app/api/v1/chat/completions/route.ts）统一处理，
 * 中转站不再参与权限解析和限流决策。
 *
 * 职责边界：中转站仅通过模型元数据（StationModel）声明静态策略信息
 * （如 minPermissionLevel、maxCallsPerHour），由主入口在聚合层统一裁决。
 * 
 * authKey 透传给子站：openai-forward 站将其用作用户自持 API Key 直接调用上游服务，
 * coze 站忽略 authKey（使用 Coze SDK 内置凭证）。
 */

/**
 * 中转站提供的模型信息
 */
export interface StationModel {
  /** 模型唯一标识 */
  id: string;
  
  /** 模型显示名称（可选，用于前端展示） */
  name?: string;
  
  /** 模型描述（可选） */
  description?: string;
  
  /** 每小时最大调用次数（可选，由主入口执行模型级全局限流） */
  maxCallsPerHour?: number;

  /**
   * 最低权限等级门槛（可选，由子站声明、主入口裁决）
   * 请求者 permissionLevel 低于此值时拒绝访问；缺省表示对所有等级开放
   */
  minPermissionLevel?: number;
}

/**
 * 转发请求参数
 */
export interface ForwardRequest {
  /** 请求的模型 ID */
  model: string;
  
  /** 消息列表 */
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  
  /** 是否流式输出 */
  stream?: boolean;
  
  /** 温度参数 */
  temperature?: number;
  
  /** 最大输出 token 数 */
  max_tokens?: number;
  
  /** 其他参数 */
  [key: string]: unknown;
  
  /** 原始请求头（用于透传） */
  headers: Headers;
  
  /** 请求 ID（用于日志追踪） */
  requestId: string;

  /** 从 Authorization 头提取的用户 key（由主入口权限解析后透传，子站按需使用） */
  authKey?: string;
}

/**
 * 中转站接口
 * 
 * 所有中转站必须实现此接口。
 * 中转站职责：
 * 1. 声明自己能处理的模型
 * 2. 将请求转发到具体的模型服务
 * 
 * 注意：权限解析与限流由主入口统一处理，中转站不应自行实现。
 */
export interface Station {
  /** 中转站唯一标识 */
  readonly id: string;
  
  /** 中转站显示名称 */
  readonly name: string;
  
  /**
   * 获取此中转站提供的模型列表
   * 返回空数组表示此中转站当前不可用（例如环境不满足）
   */
  getModels(): StationModel[] | Promise<StationModel[]>;
  
  /**
   * 判断是否处理该模型
   * @param modelId 模型 ID
   * @returns 是否由本中转站处理
   */
  canHandle(modelId: string): boolean;
  
  /**
   * 转发请求
   * @param request 转发请求参数
   * @returns 响应（支持流式和非流式）
   */
  forward(request: ForwardRequest): Promise<Response>;
}

/**
 * 凭证字段定义（用于 Admin 页面动态渲染表单）
 */
export interface CredentialField {
  /** 字段标识 */
  key: string;
  /** 字段显示名称 */
  label: string;
  /** 字段类型 */
  type: 'text' | 'password' | 'url' | 'number' | 'group';
  /** 是否必填 */
  required: boolean;
  /** 字段描述（用于提示） */
  description?: string;
  /** 占位符 */
  placeholder?: string;
  /** 当前值（用于回显） */
  value?: string;
  /** 子字段（仅 type='group' 时使用） */
  children?: CredentialField[];
}

/**
 * 模型启停状态
 */
export interface ModelToggle {
  /** 模型 ID */
  id: string;
  /** 模型显示名称 */
  name: string;
  /** 模型描述 */
  description?: string;
  /** 是否启用 */
  enabled: boolean;
}

/**
 * Admin 可管理子站接口（可选）
 *
 * 子站选择实现此接口表示"接受 Admin 管理"。
 * 主入口（Admin 页面 + API）只负责发现和透传，不关心子站内部实现。
 */
export interface AdminManagedStation {
  /** 子站 id（与 Station.id 一致） */
  readonly id: string;
  /** 子站显示名称 */
  readonly name: string;
  /** 是否需要凭证配置 */
  readonly hasCredentialConfig: boolean;
  /** 是否有模型启停开关 */
  readonly hasModelToggle: boolean;

  /**
   * 获取凭证配置 schema（字段定义，用于 Admin 页面动态渲染表单）
   */
  getCredentialSchema(): Promise<CredentialField[]>;

  /**
   * 获取当前凭证配置值
   */
  getCredentialConfig(): Promise<CredentialField[]>;

  /**
   * 更新凭证配置
   * 子站自行实现持久化和运行时生效
   */
  updateCredentialConfig(fields: CredentialField[]): Promise<void>;

  /**
   * 获取模型启停状态列表
   */
  getModelToggles(): Promise<ModelToggle[]>;

  /**
   * 更新单个模型的启停状态
   */
  updateModelToggle(modelId: string, enabled: boolean): Promise<void>;
}

/**
 * 注册表增加：获取所有实现了 AdminManagedStation 的子站
 */
export interface StationRegistry {
  /**
   * 注册中转站
   */
  register(station: Station): void;
  
  /**
   * 获取所有可用的模型
   */
  getAllModels(): Promise<StationModel[]>;
  
  /**
   * 查找能处理指定模型的中转站
   * @returns 中转站实例，如果没有找到返回 null
   */
  findStation(modelId: string): Station | null;
  
  /**
   * 查找指定模型的元数据（含 minPermissionLevel 等策略声明）
   * @returns 模型元数据，如果没有找到返回 null
   */
  findModel(modelId: string): Promise<StationModel | null>;
  
  /**
   * 获取所有已注册的中转站
   */
  getStations(): Station[];

  /**
   * 获取所有实现了 AdminManagedStation 的子站
   */
  getAdminManagedStations(): AdminManagedStation[];
  
  /**
   * 重置注册表（用于测试）
   */
  reset(): void;
}
