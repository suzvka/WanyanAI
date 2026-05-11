# MCP / OutputMode 职责重构方案

## 目标
- 消除假 handler，恢复工具真实执行能力
- 消除框架层硬编码工具名（`finalize_report`、`multi_collect_complete` 等）
- 明确 `abort_workflow` 职责边界
- 保留第三方模块容错能力
- 为 Agent 动态切换输出模式预留扩展点

---

## 一、问题与对策速查

| # | 问题 | 当前状态 | 目标状态 |
|---|------|----------|----------|
| 1 | Server Action 走 HTTP 绕路 | `runAnalysisTask.ts` 调用 `services/output-modes/client.ts` 发 HTTP 请求获取工具定义 | Server Action 直接 import 服务端模块获取真实工具定义 |
| 2 | 假 handler | `createClientToolDefinition()` 创建空 handler | 传递真实 `handler`，但引入执行分级隔离 |
| 3 | `finalize_report` 泄漏到 Adapter | `StreamingMCPAdapter` 硬编码判断 `finalize_report` | 下放到 `OutputModeModule.resolveToolCall()` |
| 4 | 工具名硬编码在任务执行层 | `resolveToolData()` 硬编码 `multi_collect_complete`/`submit_report`/`abort_workflow` | 通过 `OutputModeModule.resolveToolCall()` 委托给模块 |
| 5 | `abort_workflow` 双重注入 | 模块重复导入 + 框架兜底 | 明确由框架统一注入，模块不再重复 |
| 6 | MCP 全局注册表孤儿 | `src/mcp/registry.ts` 无人使用 | 移除冗余，或改造为 Adapter 内部注册表 |
| 7 | API 路由直接对话注册表 | 路由层直接 `getOutputModeModule()` | 增加 Service 层，路由只负责 HTTP 适配 |

---

## 二、核心设计：OutputModeModule 接口扩展

### 2.1 新增方法

```typescript
// src/server/output-modes/types.ts
export interface OutputModeModule {
  id: string;
  name: string;
  prompt: string;
  mcpToolDefinitions?: McpToolDefinition[];
  validate: (data: unknown) => ValidationResult;
  buildScoringContext: (params: BuildScoringContextParams) => ReportScoringContext;
  assemble?: (collectedData: CollectedToolData) => unknown;

  /**
   * 【新增】解析单次工具调用结果
   *
   * 职责：将工具调用参数转换为模块理解的业务数据
   * 取代：runAnalysisTask.ts 中的 resolveToolData() 硬编码
   */
  resolveToolCall?: (
    toolName: string,
    params: Record<string, unknown>
  ) => {
    type: 'data' | 'abort' | 'finalize' | 'unknown';
    data?: Record<string, unknown>;
    reason?: string;
    message?: string;
  };

  /**
   * 【新增】获取本模块需要框架注入的框架级工具
   *
   * 职责：声明模块依赖的框架通用工具（如 abort_workflow）
   * 默认返回 ['abort_workflow']
   */
  getFrameworkToolNames?: () => string[];
}
```

### 2.2 resolveToolCall 的默认实现

```typescript
// 框架提供默认实现，模块可覆盖
export function createDefaultResolveToolCall(
  moduleId: string,
  assembleFn?: (collectedData: CollectedToolData) => unknown
) {
  return (toolName: string, params: Record<string, unknown>) => {
    // abort_workflow：由框架注入，所有模块统一处理
    if (toolName === 'abort_workflow') {
      return {
        type: 'abort' as const,
        reason: params.reason as string,
        message: params.message as string,
      };
    }

    // finalize_report：结束多工具收集，触发 assemble
    if (toolName === 'finalize_report') {
      return { type: 'finalize' as const };
    }

    // submit_report：单工具直接提交
    if (toolName === 'submit_report') {
      return { type: 'data' as const, data: params };
    }

    // 其他工具调用：默认透传（允许模块覆盖）
    return { type: 'unknown' as const };
  };
}
```

> **关键设计**：默认实现保留当前硬编码逻辑作为向后兼容，但允许每个模块覆盖。框架不再在 Adapter 层硬编码 `finalize_report` 的特殊处理。

---

## 三、StreamingMCPAdapter 改造

### 3.1 移除业务硬编码

```typescript
// 当前（问题代码）
if (toolEvent.name === 'finalize_report') {
  this.capturedToolCall = {
    name: 'multi_collect_complete',
    params: this.collectedData,
  };
}

// 改造后
// Adapter 只做一件事：把原始工具调用捕获并返回
// 具体含义由调用方（runAnalysisTask）通过 OutputModeModule.resolveToolCall() 解释
```

### 3.2 改造后职责

| 职责 | 归属 | 说明 |
|------|------|------|
| 流式解析 SSE | `StreamingMCPClient` | 不变 |
| 工具标签提取 | `StreamingMCPClient` | 不变 |
| handler 执行 | `StreamingMCPClient.executeTool()` | 真实执行，不再假执行 |
| 事件分发 | `StreamingMCPAdapter` | 不变 |
| 工具调用语义解释 | `OutputModeModule.resolveToolCall()` | 【新增/迁移】 |
| 多工具数据收集 | `StreamingMCPAdapter` | 不变，收集到 `this.collectedData` |

---

## 四、工具执行分级：保留容错，恢复真实能力

### 4.1 分级定义

```typescript
// src/mcp/types.ts
export enum ToolExecutionLevel {
  /** 纯数据收集：handler 只返回输入参数，无副作用 */
  PURE = 'pure',
  /** 有副作用：handler 可能读取数据库、调外部 API */
  EFFECTFUL = 'effectful',
  /** 高危：handler 可能写数据、删除资源 */
  DANGEROUS = 'dangerous',
}

// 在 McpToolDefinition 中增加标记
export type McpToolDefinition<...> = {
  name: string;
  description: string;
  parameters: McpToolParameter[];
  inputSchema: TSchema;
  handler: McpToolHandler<TSchema, TResult>;
  executionLevel?: ToolExecutionLevel; // 【新增】默认 PURE
};
```

### 4.2 运行时隔离

```typescript
// src/mcp/sandbox.ts
export async function executeToolSafely<T>(
  tool: McpToolDefinition,
  params: Record<string, unknown>,
  context: McpInvokeContext,
  options: {
    maxThirdPartyLevel?: ToolExecutionLevel; // 第三方模块允许的最高级别
    timeoutMs?: number;
  } = {}
): Promise<McpToolHandlerResult<T>> {
  const level = tool.executionLevel ?? ToolExecutionLevel.PURE;
  const maxAllowed = options.maxThirdPartyLevel ?? ToolExecutionLevel.PURE;

  // 如果工具级别超过允许范围，降级为假执行
  if (level > maxAllowed) {
    return {
      ok: true,
      data: params,
      message: `Tool ${tool.name} executed in degraded mode (level ${level} > ${maxAllowed})`,
    };
  }

  // 否则真实执行，带超时保护
  return Promise.race([
    tool.handler(params, context),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Tool ${tool.name} timeout`)),
        options.timeoutMs ?? 10000)
    ),
  ]);
}
```

### 4.3 容错策略

| 来源 | 默认允许级别 | 可配置 |
|------|-------------|--------|
| 内置模块（literary-review, gaokao-essay） | `EFFECTFUL` | 平台配置 |
| 第三方模块 | `PURE`（当前假 handler 等效） | 安装时用户确认升级 |
| 框架工具（abort_workflow） | `PURE` | 不可配置 |

> **关键洞察**：当前所有实际工具的 handler 都是 `PURE` 级别（纯数据转换）。引入分级后，**当前行为完全不变**（第三方默认 `PURE` = 假执行），但为未来扩展打开了空间。

---

## 五、abort_workflow 职责明确化

### 5.1 方案 A：框架统一注入（推荐）

```typescript
// 模块不再导入 abortWorkflowTool
// src/features/output-modes/literary-review/mcp-tools.ts
export function getLiteraryReviewMcpTools(): McpToolDefinition[] {
  return [
    collectSummaryMcpTool,
    collectSubscoreMcpTool,
    // ... 只包含业务工具
    // 不再包含 abortWorkflowTool
  ];
}

// 框架在组装工具时统一注入
// src/server/output-modes/registry.ts
function injectFrameworkTools(tools: McpToolDefinition[]): McpToolDefinition[] {
  const hasAbort = tools.some(t => t.name === 'abort_workflow');
  if (hasAbort) {
    // 日志警告：模块不应自行声明框架工具
    logger.warn('Module should not declare abort_workflow, it is injected by framework');
  }
  return [...tools, abortWorkflowTool];
}
```

### 5.2 方案 B：模块显式声明依赖

```typescript
// OutputModeModule.getFrameworkToolNames() 返回 ['abort_workflow']
// 框架根据声明注入，未声明则不注入（模块自己负责）
```

> **推荐方案 A**：简单、明确、零配置。`abort_workflow` 是框架级通用能力，所有模块默认拥有。

---

## 六、runAnalysisTask.ts 改造

### 6.1 消除 HTTP 绕路

```typescript
// 改造前：通过 HTTP 客户端获取
const mcpToolDefinitions = await getOutputModeToolDefinitions(
  task.moduleConfig.manifest.outputMode
);

// 改造后：直接 import 服务端模块
import { getOutputModeModule } from '@/server/output-modes/registry';

const outputMode = getOutputModeModule(task.moduleConfig.manifest.outputMode);
if (!outputMode) { throw ... }

// 获取真实工具定义（含真实 handler）
const rawTools = outputMode.mcpToolDefinitions ?? [];
// 框架注入通用工具
const mcpToolDefinitions = injectFrameworkTools(rawTools);
```

### 6.2 消除 resolveToolData 硬编码

```typescript
// 改造前
async function resolveToolData(task, toolCall) {
  if (toolCall.name === 'multi_collect_complete') { ... }
  if (toolCall.name === 'submit_report') { ... }
  if (toolCall.name === 'abort_workflow') { ... }
}

// 改造后
async function resolveToolData(task, toolCall, collectedData) {
  const outputMode = getOutputModeModule(task.moduleConfig.manifest.outputMode);

  // 优先使用模块自定义的解析逻辑
  if (outputMode?.resolveToolCall) {
    const result = outputMode.resolveToolCall(toolCall.name, toolCall.params);

    switch (result.type) {
      case 'data':
        return result.data!;
      case 'abort':
        throw createAppError({
          code: 'provider_response_invalid',
          message: `分析中止：${result.reason} - ${result.message}`,
          retryable: false,
        });
      case 'finalize':
        // 触发 assemble
        const assembled = outputModeRegistry.assemble(
          outputMode.id,
          collectedData
        );
        return assembled.data ?? {};
      case 'unknown':
        // 回退到默认行为
        break;
    }
  }

  // 默认行为：透传参数（兼容旧模块）
  return toolCall.params;
}
```

---

## 七、API 路由 / 客户端服务层调整

### 7.1 服务端 API 路由职责收缩

```typescript
// src/app/api/output-modes/tools/route.ts
// 保留此 API，但职责明确：只返回元数据（name/description/parameters），不包含 handler

export async function GET(request: NextRequest) {
  const outputModeId = searchParams.get('outputModeId');
  const module = getOutputModeModule(outputModeId);

  // 只返回描述性元数据，handler 不在 JSON 中序列化
  return outputModeSuccess({
    tools: (module.mcpToolDefinitions ?? []).map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
      executionLevel: tool.executionLevel, // 新增：告知客户端工具级别
    })),
  });
}
```

### 7.2 客户端服务层改造

```typescript
// src/services/output-modes/client.ts
// 改造后：只用于客户端场景（如 Agent 运行时动态获取元数据）
// Server Action 不再调用此文件

export async function getOutputModeToolDefinitions(outputModeId: string): Promise<McpToolDefinition[]> {
  // 从 API 获取元数据
  const result = await requestJson<...>(`/api/output-modes/tools?...`);

  // 创建客户端假 handler（仅用于客户端预览/调试，不用于真实分析）
  return result.data.tools.map(tool => ({
    ...tool,
    inputSchema: z.any(), // 客户端不需要严格校验
    handler: createClientStubHandler(tool.name), // 明确标记为 stub
  }));
}
```

### 7.3 新增 Service 层

```typescript
// src/server/output-modes/service.ts
// 路由层调用 service，service 调用注册表

export async function getOutputModeToolsService(outputModeId: string) {
  const module = getOutputModeModule(outputModeId);
  if (!module) throw new NotFoundError();
  return injectFrameworkTools(module.mcpToolDefinitions ?? []);
}

export async function assembleOutputModeService(...) { ... }
export async function validateOutputModeService(...) { ... }
```

---

## 八、废弃与移除

| 项目 | 操作 | 说明 |
|------|------|------|
| `src/mcp/registry.ts` | 移除 | 全局注册表无人使用，`StreamingMCPClient` 使用实例级 Map |
| `src/mcp/invoker.ts` | 移除或合并 | 无人调用 `invokeMcpTool`，工具执行内联在 `StreamingMCPClient.executeTool()` |
| `createClientToolDefinition` | 改造 | 仅在客户端服务层使用，明确标记为 stub |
| 各模块中的 `abortWorkflowTool` import | 移除 | 框架统一注入 |

---

## 九、迁移路径

```
Step 1: 扩展 OutputModeModule 接口（新增 resolveToolCall、getFrameworkToolNames）
        ↓ 不破坏任何现有模块
Step 2: 在框架层实现 resolveToolCall 默认实现（包含当前硬编码逻辑）
        ↓ 不破坏任何现有模块
Step 3: 改造 runAnalysisTask.ts：直接 import 替代 HTTP 绕路
        ↓ 移除 services/output-modes/client.ts 在 Server Action 中的使用
Step 4: 引入 ToolExecutionLevel 和 executeToolSafely
        ↓ 当前所有工具默认 PURE，行为不变
Step 5: 移除各模块的 abortWorkflowTool import，改为框架统一注入
        ↓ 需要验证所有模块
Step 6: 移除 MCP 全局注册表（registry.ts、invoker.ts）
        ↓ 清理冗余代码
Step 7: 新增 Service 层，改造 API 路由
        ↓ 路由层不再直接对话注册表
Step 8: 各输出模式逐步覆盖 resolveToolCall，消除默认实现中的硬编码
        ↓ 长期演进
```

---

## 十、需要决策的问题

### 决策 1：工具执行分级的默认策略

当前所有工具 handler 都是纯数据转换（无副作用）。引入分级后：

- **选项 A**：所有工具默认 `PURE`，第三方模块永远无法升级（最安全，最保守）
- **选项 B**：内置模块默认 `EFFECTFUL`，第三方模块默认 `PURE`，平台提供白名单机制（推荐）
- **选项 C**：所有工具默认 `PURE`，但平台提供"模块信任度"配置，可信模块可升级（最灵活，最复杂）

**请问你的倾向？** 如果目前确实没有需要副作用的工具，选项 A 和 B 的当前行为几乎相同。

### 决策 2：abort_workflow 注入策略

- **选项 A**：框架强制注入，模块重复声明时警告但不阻止（推荐，向后兼容）
- **选项 B**：框架强制注入，模块重复声明时抛错（严格，需要改造现有模块）
- **选项 C**：通过 `getFrameworkToolNames()` 显式声明依赖，未声明的模块不注入（灵活，但增加了模块开发门槛）

**请问你的倾向？**

### 决策 3：Agent 动态加载的优先级

如果未来引入 Agent，输出模式模块是否需要支持**运行时热加载**（不重启服务即可添加新模块）？

- **是**：需要保留并强化 HTTP API 通道，模块配置需要持久化到数据库而非仅编译时 import
- **否**：当前编译时静态 import + 运行时内存注册表足够，HTTP API 仅作为客户端查询通道

**请问当前是否已规划 Agent 功能？** 这决定了是否需要为热加载预留架构空间。

### 决策 4：实施节奏

- **选项 A**：一次性全部改造（风险较高，但架构最干净）
- **选项 B**：分 3 个迭代（先接口扩展 + 消除 HTTP 绕路，再职责迁移，最后清理冗余）

**请问你的偏好？**
