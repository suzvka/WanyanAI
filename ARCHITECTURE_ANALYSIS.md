# MCP 系统架构分析报告

## 1. 架构目标

根据设计原则，MCP 系统应满足：
- **模块自治**：报告模块（输出模式）自行准备 MCP 支持函数
- **框架中立**：框架层仅提供中止工具（`abort_workflow`）
- **职责分离**：业务逻辑在模块层，框架层只提供基础设施
- **统一目录**：所有模块代码在同一目录下，便于维护

---

## 2. 当前架构状态

### 2.1 模块目录结构（已优化）

```
src/features/output-modes/literary-review/
├── index.ts              # 统一入口（导出渲染器、类型、提示词等）
├── module.ts             # 服务端模块入口（OutputModeModule 定义）✅
├── mcp-tools.ts          # MCP 工具定义 ✅ 微调提示词在这里
├── prompt.ts             # 提示词模板 ✅ 微调提示词在这里
├── subscores.ts          # 子维度定义
├── scoring.ts            # 评分计算
├── validate.ts           # 验证逻辑
├── multiplierCalculator.ts  # 乘数计算
├── renderer.tsx          # 客户端渲染器
└── components/           # UI 组件
    ├── LiteraryReviewView.tsx
    ├── GradeProgressBar.tsx
    └── SubscoreRadarChart.tsx
```

### 2.2 框架层工具

```
src/mcp/tools/
├── abortWorkflow.ts      # ✅ 框架层中止工具
├── multiCollectDefinitions.ts # ⚠️ 已废弃，仅为兼容保留
└── index.ts              # 导出 abortWorkflowTool
```

### 2.3 工具注册流程

```
模块注册 (module.ts → mcpToolDefinitions)
    ↓
OutputModeRegistry (从 features 导入)
    ↓
API /api/output-modes/tools
    ↓
runAnalysisTask.ts
    ↓
modelClient.call({ mcpToolDefinitions })
    ↓
StreamingMCPAdapter
```

---

## 3. 架构问题总结（已修复）

| 问题 | 状态 | 修复说明 |
|------|------|----------|
| **P1: 框架层包含业务工具** | ✅ 已修复 | `multiCollectDefinitions.ts` 已标记废弃 |
| **P2: 模块缺少 abort_workflow** | ✅ 已修复 | `literary-review` 已导入 abortWorkflowTool |
| **P3: 默认工具回退逻辑** | ✅ 已修复 | 改为仅使用 abortWorkflowTool 作为兜底 |
| **P4: abort_workflow 重复定义** | ✅ 已修复 | `multiCollectDefinitions.ts` 移除重复定义，改为导入 |

---

## 4. 已完成的修改

### 4.1 为 literary-review 添加 abort_workflow

```diff
// src/server/output-modes/literary-review/mcp-tool-definitions.ts
+ import { abortWorkflowTool } from '@/mcp/tools/abortWorkflow';

export function getLiteraryReviewMcpTools(): McpToolDefinition[] {
  return [
    collectSummaryMcpTool,
    collectSubscoreMcpTool,
    collectConclusionMcpTool,
    collectSectionMcpTool,
    finalizeReportMcpTool,
+   abortWorkflowTool,  // 从框架层导入
  ];
}
```

### 4.2 修改 streamingAdapter 的默认回退

```diff
// src/mcp/streamingAdapter.ts
- import { getMultiCollectMcpTools } from './tools/multiCollectDefinitions';
+ import { abortWorkflowTool } from './tools/abortWorkflow';

  const tools = mcpToolDefinitions && mcpToolDefinitions.length > 0
    ? mcpToolDefinitions
-   : getMultiCollectMcpTools();
+   : [abortWorkflowTool];  // 仅使用框架层中止工具作为兜底
```

### 4.3 清理 multiCollectDefinitions.ts

- 添加废弃注释和迁移指南
- 移除重复的 `abortWorkflowMcpTool` 定义
- 改为导入框架层的 `abortWorkflowTool`
- 更新 `src/mcp/tools/index.ts`，仅注册 abortWorkflowTool

### 4.4 修复 runAnalysisTask.ts 传递工具定义

```diff
// src/features/analysis-tasks/runAnalysisTask.ts
+ import type { McpToolDefinition } from '@/mcp/types';

+ /**
+  * 通过 API Route 获取输出模式工具定义
+  */
+ async function apiGetOutputModeToolDefinitions(
+   outputModeId: string
+ ): Promise<McpToolDefinition[]> {
+   const response = await fetch(`/api/output-modes/tools?outputModeId=${outputModeId}`);
+   const result = await response.json();
+   
+   if (result.success && result.data?.tools) {
+     return result.data.tools.map((tool: any) => ({
+       name: tool.name,
+       description: tool.description,
+       parameters: tool.parameters,
+       inputSchema: null as any,
+       handler: (params: Record<string, unknown>) => {
+         // abort_workflow 和 finalize_report 需要设置 terminate 标志
+         if (tool.name === 'abort_workflow' || tool.name === 'finalize_report') {
+           return { ok: true, data: params, terminate: true };
+         }
+         return { ok: true, data: params };
+       },
+     }));
+   }
+   return [];
+ }

  // 在调用 modelClient.call 之前获取工具定义
+ const mcpToolDefinitions = await apiGetOutputModeToolDefinitions(task.moduleConfig.manifest.outputMode);

  const result = await modelClient.call({
    baseUrl: task.modelConfig.baseUrl,
    apiKey: task.modelConfig.apiKey,
    model: task.moduleConfig.selectedModel,
    messages,
    temperature: template.recommendedParameters.temperature,
    events: progressController.createEventHandlers(),
+   mcpToolDefinitions, // 传递工具定义
  });
```

---

## 5. 待完成的工作

### 5.1 gaokao-essay 模块迁移

当前 `gaokao-essay` 模块尚未迁移到多工具模式，需要：

1. 创建 `src/server/output-modes/gaokao-essay/mcp-tool-definitions.ts`
2. 定义业务工具（参考 literary-review）
3. 导入 `abortWorkflowTool`
4. 在 `index.ts` 中导出 `mcpToolDefinitions`

### 5.2 ~~runAnalysisTask.ts 重构~~ ✅ 已完成

已通过 `apiGetOutputModeToolDefinitions` 函数从 API 获取工具定义并传递给 `modelClient.call`。

### 5.3 废弃 /api/mcp/compile API

当前 `/api/mcp/compile` 仍被 `requestCompiledMcpPrompt` 使用，应迁移到新的架构：

- 新架构：工具定义由模块提供
- 废弃：全局 MCP 工具注册表

---

## 6. 验证清单

- [x] `literary-review` 模块包含 `abort_workflow` 工具
- [ ] `gaokao-essay` 模块迁移到多工具模式
- [x] `streamingAdapter.ts` 移除业务工具回退逻辑
- [x] `multiCollectDefinitions.ts` 标记废弃并移除重复定义
- [x] `runAnalysisTask.ts` 传递 `mcpToolDefinitions` 给 `modelClient.call`
- [x] TypeScript 编译通过（`pnpm ts-check`）
- [x] 接口测试通过（`/api/output-modes/tools?outputModeId=literary-review`）

---

## 7. 架构图（改进后）

```
┌─────────────────────────────────────────────────────────────┐
│                         框架层                               │
│  ┌────────────────────────────────────────────────────┐     │
│  │  StreamingMCPClient / StreamingMCPAdapter          │     │
│  │  - 工具注册和执行                                    │     │
│  │  - 默认回退：仅 abortWorkflowTool                    │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │  abortWorkflowTool                                 │     │
│  │  - 框架层唯一工具                                    │     │
│  │  - 各模块导入使用                                    │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │  multiCollectDefinitions.ts                        │     │
│  │  - @deprecated 已废弃                               │     │
│  │  - 仅为兼容旧代码保留                                │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                          ↑ 导入
┌─────────────────────────────────────────────────────────────┐
│                         模块层                               │
│  ┌────────────────────────────────────────────────────┐     │
│  │  literary-review / mcp-tool-definitions.ts         │     │
│  │  - collect_summary                                  │     │
│  │  - collect_subscore                                 │     │
│  │  - collect_conclusion                               │     │
│  │  - collect_section                                  │     │
│  │  - finalize_report                                  │     │
│  │  - abort_workflow (从框架层导入) ✅                  │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │  gaokao-essay / mcp-tool-definitions.ts            │     │
│  │  - TODO: 待实现                                     │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. 结论

当前架构**已基本符合**设计目标：
- ✅ 模块可以定义自己的工具
- ✅ 框架层提供了 `abortWorkflowTool`
- ✅ 框架层业务工具已标记废弃
- ✅ 模块工具集完整（包含 abort_workflow）
- ✅ 默认工具回退改为仅使用 abortWorkflowTool

**后续工作优先级**：
1. **高**：为 `gaokao-essay` 实现工具定义
2. **中**：重构 `runAnalysisTask.ts`，传递 `mcpToolDefinitions`
3. **低**：废弃 `/api/mcp/compile` API
