# 项目上下文

### 技术栈

Next.js 16 (App Router) · React 19 · TypeScript 5 · Tailwind CSS 4 · shadcn/ui (Radix UI) · coze-coding-dev-sdk

## 目录结构

```
src/
├── app/                        # 页面路由与布局
│   ├── page.tsx                # 首页（模块选择）
│   ├── evaluate/[moduleId]/    # 评测页面（动态路由）
│   └── api/
│       └── v1/                 # 站内 API（鉴权、限流、转发）
│           ├── chat/completions/route.ts  # Chat Completions 转发入口
│           ├── key/route.ts               # 代理密钥签发
│           └── models/route.ts            # 模型列表
├── components/
│   ├── evaluate/EvaluateClient.tsx   # 统一渲染组件
│   ├── layout/                       # AppShell、AppSidebar
│   └── ui/                           # shadcn/ui 基础组件库
├── containers/                 # 容器注册表（analysis-controls、text-blocks，延迟初始化）
├── features/
│   ├── controls/               # 控件模块（select、multi-select）+ 注册表
│   ├── output-modes/           # 输出模式（literary-review、gaokao-essay）
│   └── analysis-controls/      # 分析控制逻辑
├── lib/
│   └── registry/               # BaseRegistry 注册表基类
├── mcp/                        # 流式 MCP 客户端（单次连接多工具调用）
├── server/                     # 模块加载、指令编译、输出模式注册表
│   └── platform-config/        # 平台配置加载
├── stations/                   # 中转站模块（可插拔的模型转发器）
│   ├── types.ts                # Station 接口定义
│   ├── registry.ts             # 中转站注册表
│   ├── loader.ts               # 启动时加载所有中转站
│   ├── openai-forward/         # OpenAI 格式中转站（keys/*.json 配置）
│   └── coze/                   # Coze 内部模型中转站（COZE_PROJECT_ENV=PROD）
└── types/                      # 全局类型定义

app-modules/<module-id>/         # 功能模块配置（运行时自动扫描加载）
├── main.json                   # 模块注册（slug、容器、输出模式）
├── controls.json               # 控件定义
└── site.json                   # 页面文案

platform-config/               # 平台级配置（manifest、appearance、feature-flags）
keys/                          # 外部 API 模型配置（自动发现 *.json）
```

## 架构要点

**模块化架构**：每个功能模块在 `app-modules/` 下独立配置，`main.json` 声明路由、容器、输出模式。`src/server/modules/loader.ts` 扫描并加载。

**容器系统**：页面由容器组成，框架固定注册容器类型（`analysis-controls`、`text-blocks`），按 `main.json` 中 `containers` 数组顺序渲染。

**输出模式（模块自治）**：每个输出模式在 `src/features/output-modes/{id}/` 下拥有完整的独立生命周期——提示词、MCP 工具、评分算法、校验逻辑、客户端渲染器。服务端在 `src/server/output-modes/registry.ts` 静态注册。

**控件模块（注册表模式）**：控件类型（select / multi-select）各自实现 `ControlModule` 接口，通过 `ControlRegistry` 注册。框架按 `type` 字段路由到对应模块。`getDefinitions()` 预计算含 `initialValue` 的定义，前端统一读取。

**流式 MCP**：自建 `StreamingMCPClient`，在单次 SSE 连接中解析 `<call tool_name>` 标签并执行工具调用，避免 `@obayd/agentic` Conversation 类的 N+1 请求问题。

**提示词拼接顺序**：输出模式提示词（`getServerOutputModePrompt`）→ 动态指令（用户选择编译）

**延迟初始化（统一注册表基类）**：三套注册表均继承 `BaseRegistry<TModule>`（`src/lib/registry/BaseRegistry.ts`），统一延迟初始化、幂等、reset 等生命周期行为。服务端注册表（控件、输出模式）由 `loader.ts` 在模块加载时显式调用 `initialize()`；客户端注册表（容器）通过 `renderContainer()` 的自动初始化守卫或显式调用 `initializeContainers()` 注册。

**Server Action 边界**：`src/features/analysis-tasks/runAnalysisTask.ts` 标记为 `'use server'`，是服务端唯一的任务执行入口。客户端通过 Next.js Server Action 远程调用。

**中转站系统（可插拔）**：所有模型转发通过中转站实现，位于 `src/stations/` 目录。每个中转站实现 `Station` 接口，提供 `getModels()`、`canHandle()`、`forward()` 方法。启动时自动扫描注册，删除目录即可移除功能。框架负责鉴权，中转站仅负责转发。

## 开发规范

- **包管理**：仅使用 pnpm，严禁 npm/yarn（`preinstall` 脚本会拦截）
- **UI 组件**：默认使用 `src/components/ui/` 下的 shadcn/ui 组件
- **Hydration 安全**：JSX 渲染中禁止 `typeof window`、`Date.now()`、`Math.random()`；动态内容必须用 `'use client'` + `useEffect`/`useState`；禁止非法 HTML 嵌套（如 `<p>` 嵌套 `<div>`）

## 新增功能模块

1. `app-modules/<module-id>/main.json` — 定义 slug、containers（必须含 analysis-controls）、outputMode、controlsConfig
2. `controls.json` — 控件规则（type/options/promptText/defaultSelected）
3. `site.json`（可选）— 页面文案

控件配置加载优先级：`controlsConfig` 外部文件引用 > `controls` 内联数组 > 约定文件 `./controls.json`

## 新增输出模式

目录：`src/features/output-modes/{module-id}/`

必需文件：`module.ts`（register + process + validate）、`prompt.ts`、`mcp-tools.ts`、`scoring.ts`、`validate.ts`、`renderer.tsx`

注册点：
- 服务端：`src/server/output-modes/manifest.ts`（注册清单）+ `src/server/output-modes/registry.ts`（注册表）
- 客户端渲染器：`src/features/output-modes/index.ts`

## 新增中转站

目录：`src/stations/<station-id>/`

必需文件：`index.ts`（实现 `Station` 接口）

```typescript
// src/stations/types.ts
interface Station {
  id: string;                              // 中转站唯一标识
  name: string;                            // 显示名称
  getModels(): StationModel[];             // 返回可用模型（空数组 = 禁用）
  canHandle(modelId: string): boolean;     // 判断是否能处理该模型
  forward(request: ForwardRequest): Promise<Response>;  // 转发请求
}
```

**启动流程**：
1. `src/stations/loader.ts` 扫描 `stations/` 下所有目录
2. 动态导入每个中转站
3. 调用 `getModels()` 获取模型列表
4. 注册到 `StationRegistry`

**删除中转站**：直接删除 `src/stations/<station-id>/` 目录即可，无需修改其他代码。

## Coze 内部模型

当项目部署到 Coze 内部环境（`COZE_PROJECT_ENV=PROD`）时，`src/stations/coze/` 中转站会自动启用：

**模型 ID 格式**：`coze://{model_id}`，如 `coze://doubao-seed-1-8-251228`

**可用模型**：
- `coze://doubao-seed-2-0-pro-260215` - 旗舰级全能通用模型
- `coze://doubao-seed-2-0-lite-260215` - 均衡型模型
- `coze://doubao-seed-2-0-mini-260215` - 轻量级模型
- `coze://doubao-seed-1-8-251228` - 多模态 Agent 优化模型（默认）
- `coze://doubao-seed-1-6-251015` - 通用模型
- `coze://doubao-seed-1-6-vision-250815` - 视觉理解模型
- `coze://doubao-seed-1-6-lite-251015` - 高性价比模型
- `coze://deepseek-v3-2-251201` - DeepSeek V3.2
- `coze://deepseek-r1-250528` - DeepSeek R1
- `coze://kimi-k2-5-260127` - Kimi 最强模型
- `coze://glm-5-0-260211` - GLM-5
- `coze://glm-5-turbo-260316` - GLM-5 Turbo
- `coze://glm-4-7-251222` - GLM-4.7
- `coze://minimax-m2-5-260212` - MiniMax M2.5
- `coze://minimax-m2-7-260318` - MiniMax M2.7
- `coze://qwen-3-5-plus-260215` - Qwen 3.5 Plus

**调用流程**：
1. 用户选择 `coze://` 前缀模型
2. 请求到达 `/api/v1/chat/completions`（框架鉴权）
3. `StationRegistry` 查找 `coze` 中转站
4. 中转站调用 `coze-coding-dev-sdk`，返回 OpenAI 兼容格式流

## 关键文件速查

| 文件 | 职责 |
|------|------|
| `src/server/modules/loader.ts` | 模块扫描、加载、容器验证；统一调用 ensureRegistriesInitialized() |
| `src/server/output-modes/registry.ts` | 输出模式注册表（继承 BaseRegistry，延迟初始化） |
| `src/server/output-modes/manifest.ts` | 服务端输出模式注册清单（新增输出模式在此添加） |
| `src/server/output-modes.ts` | 服务端输出模式门面（getServerOutputModePrompt 等） |
| `src/server/instructions/compile.ts` | 动态指令编译（调用 ControlRegistry.compileAll） |
| `src/server/platform-config/loader.ts` | 平台配置加载 |
| `src/features/controls/registry.ts` | 控件注册表（继承 BaseRegistry，延迟初始化） |
| `src/features/analysis-tasks/runAnalysisTask.ts` | **Server Action** — 任务执行入口（'use server'） |
| `src/containers/registry.tsx` | 容器注册表（继承 BaseRegistry，延迟初始化，客户端） |
| `src/lib/registry/BaseRegistry.ts` | 注册表基类（统一生命周期约定） |
| `src/providers/PageContext.tsx` | 页面状态管理（controlSelections 初始化读取 definition.initialValue） |
| `src/mcp/streamingClient.ts` | 流式 MCP 客户端核心 |
| `src/mcp/streamingAdapter.ts` | 流式 MCP 适配器（对外接口） |
| `src/services/model-client/index.ts` | 模型调用入口 |
| `src/stations/types.ts` | 中转站接口定义 |
| `src/stations/registry.ts` | 中转站注册表 |
| `src/stations/loader.ts` | 中转站加载器（启动时扫描注册） |
| `src/stations/openai-forward/index.ts` | OpenAI 格式中转站（keys/*.json 配置转发） |
| `src/stations/coze/index.ts` | Coze 内部模型中转站 |
| `src/app/api/v1/chat/completions/route.ts` | Chat Completions 转发入口（鉴权 + 中转站路由） |
| `src/app/api/v1/models/route.ts` | 模型列表（聚合所有中转站模型） |
