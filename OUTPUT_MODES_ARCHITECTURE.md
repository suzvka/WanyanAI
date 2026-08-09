# 输出模式架构

> 本文档描述当前输出模式系统的架构（2026-08 对齐代码库后更新）。
> 若与代码不一致，以代码为准。

## 概述

输出模式系统采用**模块自治 + 客户端/服务端分离**架构。每个输出模式（如 `literary-review`、`gaokao-essay`）在 `src/features/output-modes/<id>/` 下独立实现，自行声明提示词、MCP 工具、验证逻辑、评分逻辑、数据拼装与客户端渲染，框架仅通过统一接口调度。

## 架构分层

### 服务端 (`src/server/output-modes.ts` + `src/server/output-modes/`)

服务端注册表负责业务逻辑的调度：

- `getServerOutputModePrompt(id)`：获取提示词模板
- `getServerOutputModeName(id)` / `getServerOutputModeDescription(id)`：模块元信息（Agent 编排使用）
- `getServerOutputModeIds()`：已注册模式列表
- `validateOutputModeData(id, data)`：调用模块 `validate` 校验模型输出
- `buildOutputModeScoringContext(id, params)`：调用模块 `buildScoringContext` 构建评分上下文
- `assembleOutputModeData(id, collectedData)`：调用模块 `assemble` 拼装多工具收集的数据
- `getOutputModeTools(id)`：业务工具 + 自动注入框架工具（`abort_workflow`）
- `resolveOutputModeToolCall(id, toolName, params)`：解析工具调用语义（框架工具按名解析，业务工具交模块）

注册表实现：`src/server/output-modes/registry.ts`（`OutputModeRegistryImpl`），注册清单：`src/server/output-modes/manifest.ts`（`SERVER_OUTPUT_MODE_MANIFEST`）。

### 模块层 (`src/features/output-modes/<id>/`)

每个模块实现 `OutputModeModule` 接口（`src/server/output-modes/types.ts`）：

| 字段 | 说明 |
|------|------|
| `id` / `name` / `description` | 标识与元信息（description 供 Agent 编排） |
| `prompt` | 提示词模板（框架运行时与用户动态指令拼接） |
| `mcpToolDefinitions` | 业务 MCP 工具定义（**不含**框架工具） |
| `validate(data)` | 校验模型输出，返回 `{ success, data?, errors? }` |
| `buildScoringContext(params)` | 根据控件选择计算评分乘数 |
| `assemble(collectedData)` | 将多工具收集的数据拼装为完整报告（可选） |
| `resolveToolCall(toolName, params)` | 把业务工具调用映射为框架语义动作（可选） |
| `getFrameworkToolNames()` | 声明依赖的框架工具名（可选，默认 `['abort_workflow']`） |

模块入口统一导出 `register(registry: OutputModeRegistry)` 函数，由注册清单调用。

### 客户端 (`src/features/output-modes/`)

- `index.ts`：渲染器懒加载映射（`LAZY_RENDERER_LOADERS`）、`getOutputModeRenderer()`、`renderOutputMode()`、`hasOutputModeRenderer()`
- `manifest.ts`：客户端清单 `OUTPUT_MODE_MANIFEST`（`id` / `hasRenderer` / `getMcpTools`）、`getOutputModeMcpTools(id)` 直接获取工具定义（无需 Server Actions）
- `renderer.ts`：渲染器通用 `RendererProps<T>` 类型定义

> 历史说明：`src/app/actions/output-modes.ts`（Server Actions 桥接层）已删除，
> 客户端通过 `getOutputModeMcpTools`（manifest）与服务端能力函数（`src/server/output-modes.ts`）直接对接。

## 关键文件

| 文件 | 职责 |
|------|------|
| `src/server/output-modes.ts` | 服务端输出模式能力入口（提示词、验证、评分、拼装、工具） |
| `src/server/output-modes/registry.ts` | 注册表实现（getTools / resolveToolCall / assemble） |
| `src/server/output-modes/manifest.ts` | 服务端注册清单（`SERVER_OUTPUT_MODE_MANIFEST`） |
| `src/server/output-modes/types.ts` | `OutputModeModule` 接口与共享类型 |
| `src/features/output-modes/index.ts` | 客户端渲染器懒加载与渲染入口 |
| `src/features/output-modes/manifest.ts` | 客户端清单与 MCP 工具获取 |
| `src/features/output-modes/renderer.ts` | 渲染器通用 Props 类型定义 |

## 使用示例

### 服务端获取提示词

```typescript
import { getServerOutputModePrompt } from '@/server/output-modes';

const prompt = getServerOutputModePrompt('literary-review');
```

### 客户端获取渲染器

```typescript
import { getOutputModeRenderer } from '@/features/output-modes';

const Renderer = getOutputModeRenderer('literary-review');
```

### 客户端获取 MCP 工具定义

```typescript
import { getOutputModeMcpTools } from '@/features/output-modes';

const tools = getOutputModeMcpTools('literary-review');
// 框架工具（abort_workflow）由服务端注册表 getTools() 注入，
// 客户端 manifest 返回的是模块声明的业务工具
```

### 服务端校验与拼装

```typescript
import {
  validateOutputModeData,
  assembleOutputModeData,
} from '@/server/output-modes';

const validation = validateOutputModeData('literary-review', rawJson);
const { data } = assembleOutputModeData('literary-review', collectedData);
```

## 优势

1. **模块自治**：提示词、工具、验证、评分、拼装、渲染全部内聚在模块目录
2. **框架中立**：框架层只提供 `abort_workflow`，且由注册表统一注入，模块无需感知
3. **类型安全**：TypeScript 全程强类型，`'server-only'` 防止服务端代码打包进客户端
4. **易于扩展**：新增输出模式 = 模块目录 + 服务端清单 + 客户端清单 + 懒加载映射，详见 `docs/adding-an-output-mode.md`
