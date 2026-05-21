# 项目上下文

---

## ⚠️  重要提醒

**本项目的默认分支是 `master`，不是 `main`。**

在开始开发前，请确保你在正确的分支上：

```bash
# 检查当前分支
git branch --show-current

# 如果不在 master，切换过去
git checkout master
```

---

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
│           ├── key/route.ts               # [废弃] 代理密钥签发
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
│   ├── api-station/            # 鉴权与限流模块
│   │   ├── auth.ts             # 统一鉴权入口
│   │   ├── authClient.ts       # 认证服务客户端
│   │   ├── authExtractor.ts    # Token 提取工具
│   │   └── rateLimit.ts        # 限流逻辑
│   ├── bootstrap/              # 服务端注册表统一初始化
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

**中心化初始化（Bootstrap）**：服务端注册表（Controls、OutputModes、Stations）通过 `instrumentation.ts` 在服务启动时统一初始化，由 `src/lib/bootstrap/` 提供中心化入口 `ensureServerRegistriesInitialized()`。确保任何代码路径（页面请求、API 调用）访问注册表前，初始化已完成。客户端注册表（Containers）仍通过 `renderContainer()` 的自动初始化守卫延迟初始化。

**客户端模型调用**：模型调用完全在客户端执行，服务端不接触用户 API Key。
- 服务端只提供资源（提示词、编译结果等）通过 `getAnalysisResources.ts`
- 客户端使用 `clientAnalysisRunner.ts` 执行分析，Key 始终留在客户端
- 用户自定义 Key：直接调用第三方 API
- 内置模型：通过 `/api/v1/chat/completions` 调用中转站

**中转站系统（可插拔）**：所有模型转发通过中转站实现，位于 `src/stations/` 目录。每个中转站实现 `Station` 接口，提供 `getModels()`、`canHandle()`、`forward()` 方法。启动时自动扫描注册，删除目录即可移除功能。鉴权与限流由主入口（`/api/v1/chat/completions`）统一处理，中转站仅负责转发。

**路由隔离架构**：Server Actions 与中转站 API 通过路由隔离，安全边界清晰。
- **Server Actions**：仅服务页面应用，使用 Next.js 默认同源校验（CSRF/Origin 验证）
- **中转站 API**：通过 Route Handler 暴露（`/api/v1/chat/completions`），使用独立鉴权逻辑
- **安全配置**：不放宽 `allowedOrigins`，不修改请求头，保持 Next.js 默认安全模型

**简化鉴权架构**：采用单 Token 统一鉴权，key 同时作为限流标识和权限查询凭证。
- **业务服务器职责**：限流检查 + 检查认证服务可用性 + 格式校验 + 调用认证服务验证权限
- **认证服务器职责**：签发 key + 验证 key + 返回权限等级
- **降级策略**：认证服务离线时使用 fallback 权限（默认游客）
- **配置文件**：`platform-config/auth-service.json` 配置认证服务地址和探活参数
- **环境变量**：`AUTH_SERVICE_URL` 或 `ACCOUNT_SERVICE_URL` 作为认证服务地址的后备

## 鉴权流程

```
┌─────────────────────────────────────────────────────────────┐
│                        签发阶段                              │
│  客户端 → 认证服务器（提交身份凭证）→ 返回 key               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                        请求阶段                              │
│  ┌─────────────┐                      ┌─────────────┐       │
│  │   客户端     │────Bearer key───────►│  业务服务器  │       │
│  │             │                      │             │       │
│  │             │                      │ 1. 限流检查  │       │
│  │             │                      │    （任何场景）│      │
│  │             │                      │ 2. 检查认证   │       │
│  │             │                      │    服务可用性 │       │
│  │             │                      │ 3. 格式校验   │       │
│  │             │                      │    （可用时） │       │
│  │             │                      │ 4. 权限校验   │       │
│  │             │                      │    （可用时） │       │
│  │             │◄─────────────────────│ 5. 业务处理  │       │
│  └─────────────┘                      └─────────────┘       │
└─────────────────────────────────────────────────────────────┘

关键特性：
- 限流在任何场景下有效（本地查表）
- 认证服务不可用时跳过格式校验和权限校验，自动使用 fallback 权限
- 探活检查定期执行，避免频繁请求
- 内部组件直接生成本地 key，无需请求认证服务
```

**key 格式**：
- 标准 key：32-64 字符的字母数字下划线横线组合（认证服务签发）
- 本地 key：`local_<timestamp>_<random>`（内部组件自生成，用于站内代理）

**key 双重用途**：同一 key 在不同场景下承担不同角色：
- **鉴权凭证**：主入口通过认证服务验证 key，获取权限等级用于限流
- **上游 API Key**：openai-forward 站将 key 直接作为上游模型服务的 API Key（用户自持 Key 模式）；coze 站忽略 key（使用 Coze SDK 内置凭证）

**认证服务接口**：
- 健康检查：`GET /api/auth/health`（返回 200 表示可用）
- 验证：`POST /api/auth/verify`（返回 `{ valid, identityId, permissionLevel }`）

**认证服务配置** (`platform-config/auth-service.json`)：
```json
{
  "url": "https://auth.example.com",
  "healthCheckIntervalMs": 30000,
  "healthCheckTimeoutMs": 3000,
  "verifyTimeoutMs": 5000,
  "fallbackPermissionLevel": 1,
  "enableHealthCheck": true
}
```

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

## 关键文件速查

| 文件 | 职责 |
|------|------|
| `instrumentation.ts` | Next.js 启动钩子，预初始化服务端注册表 |
| `src/lib/bootstrap/registry-init.ts` | 服务端注册表统一初始化入口 |
| `src/lib/api-station/auth.ts` | **统一鉴权入口**（限流 + 认证服务可用性检查 + 权限校验） |
| `src/lib/api-station/authClient.ts` | **认证服务客户端**（探活 + 调用 /api/auth/verify） |
| `src/lib/api-station/keyFormat.ts` | Key 格式校验（纯函数，客户端可用） |
| `src/lib/api-station/rateLimit.ts` | 限流逻辑 |
| `src/server/platform-config/loader.ts` | 平台配置加载（含认证服务配置） |
| `platform-config/auth-service.json` | **认证服务配置**（地址、探活参数、fallback 权限） |
| `src/server/modules/loader.ts` | 模块扫描、加载、容器验证 |
| `src/server/output-modes/registry.ts` | 输出模式注册表（继承 BaseRegistry） |
| `src/server/output-modes/manifest.ts` | 服务端输出模式注册清单（新增输出模式在此添加） |
| `src/server/output-modes.ts` | 服务端输出模式门面（getServerOutputModePrompt 等） |
| `src/server/instructions/compile.ts` | 动态指令编译（调用 ControlRegistry.compileAll） |
| `src/features/controls/registry.ts` | 控件注册表（继承 BaseRegistry） |
| `src/features/analysis-tasks/getAnalysisResources.ts` | **Server Action** — 提供分析资源（提示词、编译结果），不接触 API Key |
| `src/features/analysis-tasks/clientAnalysisRunner.ts` | **客户端** — 分析任务执行器，模型调用完全在客户端 |
| `src/containers/registry.tsx` | 容器注册表（继承 BaseRegistry，客户端延迟初始化） |
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
| `src/types/apiStationAuth.ts` | 鉴权类型定义 |

## 环境变量

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `AUTH_SERVICE_URL` | 认证服务地址（优先） | `https://auth.example.com` |
| `ACCOUNT_SERVICE_URL` | 账户服务地址（兼容） | `https://account.example.com` |
| `COZE_PROJECT_ENV` | 项目环境（PROD 启用 Coze 中转站） | `PROD` |
| `DEPLOY_RUN_PORT` | 服务监听端口 | `5000` |
