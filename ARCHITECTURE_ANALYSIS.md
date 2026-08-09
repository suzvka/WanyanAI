# MCP 系统架构分析报告

> 本文档于 2026-08 对齐当前代码库（`master` 分支）后更新。
> 若与代码不一致，以代码为准。

## 1. 架构目标

根据设计原则，MCP 系统应满足：
- **模块自治**：报告模块（输出模式）自行准备 MCP 支持函数
- **框架中立**：框架层仅提供中止工具（`abort_workflow`）
- **职责分离**：业务逻辑在模块层，框架层只提供基础设施
- **统一目录**：所有模块代码在同一目录下，便于维护

## 2. 当前架构状态

### 2.1 模块目录结构

```
src/features/output-modes/literary-review/
├── module.ts              # 服务端模块入口（OutputModeModule 定义 + register()）
├── mcp-tools.ts           # MCP 工具定义（collect_summary / collect_subscore / …）
├── prompt.ts              # 提示词模板
├── subscores.ts           # 子维度定义
├── scoring.ts             # 评分计算
├── validate.ts            # Zod 校验 schema（模型输出最小报告结构）
├── multiplierCalculator.ts  # 评分乘数计算
├── renderer.tsx           # 客户端渲染器
├── types.ts               # 模块私有类型
└── components/            # 渲染子组件（LiteraryReviewView / GradeProgressBar / …）
```

其他已注册输出模式（同构结构）：`gaokao-essay`、`text-segmentation`、`checklist`。

### 2.2 框架层工具

```
src/mcp/tools/
└── abortWorkflow.ts       # ✅ 框架层唯一工具（注册表统一注入）
```

- `abortWorkflowTool` 由 `OutputModeRegistry.getTools(id)` 自动注入到每个模块的工具集，
  模块**不应**自行声明框架工具（声明后注册表会过滤并告警）。
- 历史遗留的 `multiCollectDefinitions.ts` 与 `tools/index.ts` 已删除。

### 2.3 工具注册与执行流程

```
模块注册 (server/output-modes/manifest.ts → module.register → OutputModeRegistry)
    ↓
OutputModeRegistry.getTools(id)（业务工具 + 自动注入 abort_workflow）
    ↓
客户端 getOutputModeMcpTools(id)（features/output-modes/manifest.ts）
    ↓
executeOutputMode / executeTerminal（features/analysis-flow/lib/executeOutputMode.ts）
    ↓
StreamingMCPAdapter（mcp/streamingAdapter.ts）→ StreamingMCPClient.processStream
    ↓
解析 <call> 标签 → 执行工具 → 收集 collectedData / capturedToolCall / autoFinalized
    ↓
validateAnalysisOutput（服务端 validate + assemble）→ buildScoringContext → 报告
```

## 3. 架构决策记录（现状）

| 主题 | 当前实现 |
|------|---------|
| **框架层工具** | 仅 `abort_workflow`，由注册表统一注入，模块不声明框架工具 |
| **工具语义解析** | `OutputModeModule.resolveToolCall()`：模块把业务工具调用映射为框架语义动作（`data`/`abort`/`finalize`/`unknown`）；框架工具由注册表按名解析 |
| **数据拼装** | `OutputModeModule.assemble(collectedData)`：模块将多工具收集的数据拼装为完整报告；流结束无显式终止时由 `autoFinalized` 机制兜底触发 |
| **默认回退** | `StreamingMCPAdapter` 只注册传入的工具；不再有业务工具回退逻辑 |
| **废弃 API** | `/api/mcp/compile`、`/api/instructions/compile`、`/api/output-modes/*` 已删除；`compileMcpPrompt` 由 `requestCompiledMcpPrompt.ts` 在服务端本地直接调用 |

## 4. 工具调用解析链路

```
模型输出 <call name="collect_subscore">…</call>
    ↓
StreamingMCPClient 解析并执行 handler → collectedData[toolName][] 累积
    ↓
终止工具（finalize_report / abort_workflow）或流结束（autoFinalized）
    ↓
OutputModeRegistry.resolveToolCall(id, toolName, params)
    ├─ 框架工具（abort_workflow）→ 注册表按名解析为 { type: 'abort' }
    └─ 业务工具（finalize_report 等）→ 模块 resolveToolCall 解释为 { type: 'finalize' | 'data' | … }
    ↓
validateAnalysisOutput → 成功则 assemble → 报告
```

## 5. 验证清单（当前状态）

- [x] `literary-review` / `gaokao-essay` 均已迁移到多工具模式（`mcp-tools.ts`）
- [x] 框架工具 `abort_workflow` 由注册表统一注入（`registry.getTools`）
- [x] `multiCollectDefinitions.ts` 已删除，无业务工具回退逻辑
- [x] 工具定义通过 `getOutputModeMcpTools` 传递到 `StreamingMCPAdapter`
- [x] 模块通过 `resolveToolCall` + `assemble` 自治解释业务工具
- [x] TypeScript 编译通过（`pnpm ts-check`）
- [x] 废弃 API 路由已删除（`/api/mcp/compile` 等），`compileMcpPrompt` 改为服务端本地调用

## 6. 架构图（现状）

```
┌─────────────────────────────────────────────────────────────┐
│                         框架层                               │
│  ┌────────────────────────────────────────────────────┐     │
│  │  StreamingMCPClient / StreamingMCPAdapter          │     │
│  │  - <call> 标签解析 + 工具执行 + 事件分发             │     │
│  │  - 无业务工具回退                                   │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │  abortWorkflowTool（mcp/tools/abortWorkflow.ts）     │     │
│  │  - 框架层唯一工具                                    │     │
│  │  - 由注册表 getTools() 统一注入                     │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                          ↑ 调度 / 注入
┌─────────────────────────────────────────────────────────────┐
│                      注册表层                                │
│  OutputModeRegistry（server/output-modes/registry.ts）      │
│  - getTools(): 业务工具 + 注入框架工具                       │
│  - resolveToolCall(): 框架工具按名解析，业务工具交模块        │
│  - assemble(): 调用模块 assemble 拼装报告                    │
│  注册清单：server/output-modes/manifest.ts                   │
└─────────────────────────────────────────────────────────────┘
                          ↑ 注册
┌─────────────────────────────────────────────────────────────┐
│                         模块层                               │
│  features/output-modes/literary-review/                     │
│  - module.ts（register + OutputModeModule 实现）             │
│  - mcp-tools.ts（collect_summary / collect_subscore /       │
│                  collect_conclusion / collect_section /      │
│                  finalize_report）                           │
│  features/output-modes/gaokao-essay/（同构）                 │
│  features/output-modes/text-segmentation/、checklist/       │
└─────────────────────────────────────────────────────────────┘
```

## 7. 结论

当前架构**符合**设计目标：
- ✅ 模块自治：每个输出模式自带提示词、工具、验证、评分、拼装与渲染
- ✅ 框架中立：框架层仅提供 `abortWorkflowTool`，且由注册表统一注入
- ✅ 职责分离：工具语义解析下沉到模块（`resolveToolCall`），框架只做流解析与执行
- ✅ 废弃代码已清理：`multiCollectDefinitions`、`/api/mcp/compile` 等均已移除

**后续工作优先级**：
1. **高**：补充测试（当前项目无任何测试文件，核心链路依赖手测回归）
2. **中**：清理 `src/mcp/compiler.ts`（仅被 `requestCompiledMcpPrompt.ts` 使用，无 HTTP 入口）
3. **低**：文档与代码定期同步（本文档即对齐产物）
