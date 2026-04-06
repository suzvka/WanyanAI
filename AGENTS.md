# 项目上下文

### 版本技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4

## 目录结构

```
├── app-modules/                    # 功能模块配置目录
│   └── novel-evaluate/             # 小说评价模块
│       ├── main.json               # 模块注册配置（含容器配置、输出模式）
│       ├── site.json               # 页面文案
│       └── analysis-controls.json  # 分析控制配置
│
├── ops-config/                     # 平台配置目录
│   ├── manifest.json               # 平台版本信息
│   ├── appearance.json             # 外观配置
│   ├── feature-flags.json          # 功能开关
│   └── prompt-blocks/              # 系统提示词块（按文件名顺序拼接）
│
├── src/
│   ├── app/                        # 页面路由与布局
│   │   ├── page.tsx                # 平台首页（引导页）
│   │   └── evaluate/
│   │       └── [moduleId]/
│   │           └── page.tsx        # 模块统一渲染入口
│   │
│   ├── components/
│   │   ├── evaluate/               # 评测模块组件
│   │   │   └── EvaluateClient.tsx  # 统一渲染组件
│   │   ├── landing/                # 引导页组件
│   │   │   └── LandingClient.tsx   # 平台首页组件
│   │   ├── layout/                 # 布局组件
│   │   │   ├── AppShell.tsx        # 应用框架
│   │   │   └── AppSidebar.tsx      # 动态侧栏
│   │   ├── report/                 # 报告组件
│   │   └── ui/                     # Shadcn UI 组件库
│   │
│   ├── containers/                 # 容器系统（新增）
│   │   ├── registry.tsx            # 容器注册表
│   │   ├── index.ts                # 容器导出入口
│   │   ├── analysis-controls/      # 分析设置容器
│   │   └── text-blocks/            # 文本块编辑器容器
│   │
│   ├── features/                   # 功能模块
│   │   ├── analysis-controls/      # 分析控制
│   │   ├── analysis-flow/          # 分析流程
│   │   ├── model-config/           # 模型配置
│   │   ├── output-modes/           # 输出模式（新增）
│   │   │   ├── registry.ts         # 输出模式注册表
│   │   │   ├── literary-review/    # 文学作品评审模式
│   │   │   └── gaokao-essay/       # 高考作文评分模式
│   │   └── text-blocks/            # 文本块编辑
│   │
│   ├── server/
│   │   ├── config/                 # 平台配置加载
│   │   ├── modules/                # 模块配置加载
│   │   ├── instructions/           # 指令编译
│   │   │   └── compile.ts          # 动态指令编译
│   │   ├── promptBlocks/           # 提示词块加载
│   │   │
│   │   ├── output-modes/           # 输出模式系统（注册表 + 接口）
│   │   │   ├── types.ts            # 模块接口定义
│   │   │   └── registry.ts         # 静态注册表
│   │   │
│   │   └── output-modes.ts         # 向后兼容的重导出层
│   │
│   ├── types/                      # 类型定义
│   │   ├── module.ts               # 模块类型（含容器配置）
│   │   ├── platform.ts             # 平台类型
│   │   ├── report.ts               # 报告类型
│   │   └── appFlow.ts              # 流程类型
│   │
│   ├── hooks/                      # 自定义 Hooks
│   ├── lib/                        # 工具库
│   ├── mcp/                        # MCP 流式处理系统
│   │   ├── streamingClient.ts      # 流式 MCP 客户端（核心实现）
│   │   ├── streamingAdapter.ts     # 流式 MCP 适配器（对外接口）
│   │   └── tools/                  # 框架层 MCP 工具
│   ├── services/                   # 服务层
│   └── config/                     # 前端配置
│
├── next.config.ts                  # Next.js 配置
├── package.json                    # 项目依赖管理
└── tsconfig.json                   # TypeScript 配置
```

## 架构说明

### 模块化架构

项目采用**模块化架构**，每个功能模块独立配置：

- **模块目录**：`app-modules/{module-id}/`
- **模块配置**：`main.json` 定义模块 ID、名称、路由、容器配置、输出模式
- **模块加载**：`src/server/modules/` 扫描并加载所有模块

### 容器系统（新增）

页面由**容器**组成，容器类型由框架固定注册：

- **analysis-controls**：分析设置面板（基础容器，必须存在）
- **text-blocks**：文本块编辑器（可配置多个实例）

容器配置在 `main.json` 的 `containers` 数组中定义，按顺序渲染。

### 输出模式系统（新架构）

输出模式采用**模块自治架构**，每个模块完全独立：

**核心原则**：
1. **完全自治**：每个模块定义自己的数据类型、提示词、MCP工具、验证逻辑、评分算法
2. **静态注册**：服务端在 `src/server/output-modes/registry.ts` 中显式注册内置输出模式
3. **服务端主导**：业务逻辑全部在服务端完成
4. **客户端纯渲染**：渲染器只接收已处理的数据

**已支持的模式**：
- **literary-review**：文学作品评审报告格式（6个维度）
- **gaokao-essay**：高考作文评分报告格式（满分60分，6个维度）

**模块结构**：
```
src/features/output-modes/{module-id}/
├── module.ts       # 服务端模块入口（register + process + validate）
├── prompt.ts       # 提示词模板
├── mcp-tools.ts    # MCP 工具定义
├── scoring.ts      # 评分逻辑
├── validate.ts     # 数据校验
├── renderer.tsx    # 客户端渲染入口
└── components/     # 模块私有 UI 组件
```

输出模式配置在 `main.json` 的 `outputMode` 字段中指定。

### 提示词拼接顺序

系统提示词按以下顺序拼接：

1. `ops-config/prompt-blocks/` 目录下的静态提示词（按文件名排序）
2. 输出格式规定（来自输出模式的 `prompt` 字段）
3. 动态指令（根据用户选择的分析控制项编译）

### 配置分离

- **平台配置**（`ops-config/`）：全局外观、功能开关、版本信息、系统提示词块
- **模块配置**（`app-modules/`）：每个模块独立的容器配置、输出模式、页面文案

### 路由结构

- `/` - 平台首页（模块选择）
- `/evaluate/{moduleId}` - 模块评测页面（动态路由）

## 包管理规范

**仅允许使用 pnpm** 作为包管理器，**严禁使用 npm 或 yarn**。

**常用命令**：
- 安装依赖：`pnpm add <package>`
- 安装开发依赖：`pnpm add -D <package>`
- 安装所有依赖：`pnpm install`
- 移除依赖：`pnpm remove <package>`

## 开发规范

- **项目理解加速**：初始可以依赖项目下 `package.json` 文件理解项目类型，如果没有或无法理解退化成阅读其他文件。
- **Hydration 错误预防**：严禁在 JSX 渲染逻辑中直接使用 typeof window、Date.now()、Math.random() 等动态数据。必须使用 'use client' 并配合 useEffect + useState 确保动态内容仅在客户端挂载后渲染；同时严禁非法 HTML 嵌套（如 <p> 嵌套 <div>）。

## UI 设计与组件规范 (UI & Styling Standards)

- 模板默认预装核心组件库 `shadcn/ui`，位于 `src/components/ui/` 目录下
- Next.js 项目**必须默认**采用 shadcn/ui 组件、风格和规范，**除非用户指定用其他的组件和规范。**

## 新增模块流程

1. 在 `app-modules/` 下创建新目录
2. 创建 `main.json`（必需）：
   - 定义模块 ID、名称、路由
   - 定义 `containers` 数组（必须包含 `analysis-controls`）
   - 定义 `outputMode`（目前支持 `literary-review`、`gaokao-essay`）
3. 创建 `site.json`（可选）：页面文案配置
4. 创建 `analysis-controls.json`（可选）：分析控制配置
5. 重启服务，模块自动加载到侧栏

**main.json 配置示例**：
```json
{
  "id": "novel-evaluate",
  "name": "小说评价报告",
  "route": "/evaluate/novel-evaluate",
  "containers": [
    { "type": "analysis-controls" },
    { 
      "type": "text-blocks", 
      "params": { 
        "blockType": "actual_text", 
        "defaultExpanded": true, 
        "initialBlockCount": 1 
      } 
    }
  ],
  "outputMode": "literary-review",
  "sidebar": {
    "enabled": true,
    "icon": "BookOpen",
    "order": 1
  }
}
```

## 关键文件

| 文件 | 用途 |
|------|------|
| `src/server/output-modes/types.ts` | 输出模式模块接口定义 |
| `src/server/output-modes/registry.ts` | 输出模式静态注册表 |
| `src/server/modules/loader.ts` | 模块扫描与加载，含容器配置验证 |
| `src/server/modules/schemas.ts` | 模块配置 Schema 验证 |
| `src/server/instructions/compile.ts` | 动态指令编译服务 |
| `src/containers/registry.tsx` | 容器类型注册表 |
| `src/features/output-modes/index.ts` | 客户端渲染器映射 |
| `src/components/evaluate/EvaluateClient.tsx` | 统一渲染组件 |
| `src/components/landing/LandingClient.tsx` | 平台首页组件 |
| `src/components/layout/AppSidebar.tsx` | 动态侧栏（根据模块配置渲染） |
| `src/mcp/streamingClient.ts` | 流式 MCP 客户端（单次请求多工具调用） |
| `src/mcp/streamingAdapter.ts` | 流式 MCP 适配器（对外接口） |
| `src/mcp/tools/abortWorkflow.ts` | 框架层中止工具定义 |
| `src/services/model-client/index.ts` | 模型调用入口（使用 StreamingMCPAdapter） |

## 新增输出模式流程

1. **创建模块目录**：`src/features/output-modes/{module-id}/`

2. **实现模块接口**（必需）：
   - `module.ts`：导出 `register()` 并实现服务端处理逻辑
   - `types.ts`：定义数据类型（子维度 ID、报告结构等）
   - `prompt.ts`：定义提示词模板（MCP 工具说明、子维度列表、评级标准）
   - `mcp-tools.ts`：定义 MCP 工具（使用项目内 `McpToolDefinition`）
   - `scoring.ts`：实现评分计算
   - `validate.ts`：实现数据验证
   - `renderer.tsx`：实现客户端渲染入口

3. **注册到注册表**：在 `src/server/output-modes/registry.ts` 添加导入

4. **创建客户端渲染器**：`src/features/output-modes/{module-id}/renderer.tsx`

5. **注册渲染器**：在 `src/features/output-modes/index.ts` 添加映射

**模块接口定义**：
```typescript
interface OutputModeModule {
  id: string;                              // 模块标识
  name: string;                            // 显示名称
  prompt: string;                          // 提示词模板
  mcpTool: Tool;                           // MCP 工具定义
  validate: (data) => ValidationResult;    // 数据验证
  process: (input) => ProcessedReportData; // 验证+标准化+评分
  buildScoringContext: (params) => Context; // 评分上下文构建
}
```

## 流式 MCP 系统

### 设计目标

项目使用自定义的 `StreamingMCPClient` 实现 MCP 工具调用，而非使用 `@obayd/agentic` 的 `Conversation` 类。原因是：

1. **@obayd/agentic 的限制**：`Conversation` 类在工具调用后会自动发起新的 HTTP 请求（Agent 循环），导致速率限制问题
2. **流式需求**：需要在单次 HTTP 连接中完成所有工具调用，避免多次请求

### 架构说明

```
StreamingMCPClient（核心）
  ├── 工具注册
  ├── SSE 流解析
  ├── 工具调用解析
  ├── 工具执行
  └── 数据收集

StreamingMCPAdapter（适配器）
  ├── 封装 StreamingMCPClient
  ├── 事件处理（onFirstToken, onThinkStart 等）
  └── 与 model-client 集成

Output mode MCP tools（模块自治）
  ├── literary-review/mcp-tools.ts
  ├── gaokao-essay/mcp-tools.ts
  └── abortWorkflow.ts（框架层兜底工具）
```

### 工作流程

1. **单次请求**：`StreamingMCPClient.stream()` 发起一次 HTTP 请求
2. **流式解析**：解析 SSE 流，检测工具调用标签 `<call tool_name>`
3. **工具执行**：解析 JSON 参数，执行工具 action，收集数据
4. **继续流**：不中断流，继续等待下一个工具调用
5. **终止标志**：当 `finalize_report` 被调用时，设置终止标志
6. **数据返回**：流结束后返回所有收集的数据

### 工具调用格式

模型使用以下格式调用工具：

```
<call tool_name>
{ "param1": "value1", "param2": "value2" }
</call>
```

例如：
```
<call collect_summary>
{ "title": "《春江花月夜》赏析", "overview": "张若虚的《春江花月夜》..." }
</call>

<call collect_subscore>
{ "id": "language_expression", "grade": "S", "score": 95, "rationale": "语言清丽脱俗..." }
</call>
```

### 与 @obayd/agentic 的区别

| 特性 | StreamingMCPClient | @obayd/agentic Conversation |
|------|-------------------|----------------------------|
| 工具调用后 | 继续当前流 | 发起新请求 |
| HTTP 请求数 | 1 次 | N+1 次（N=工具调用次数） |
| 速率限制 | 不受影响 | 容易触发 |
| 复杂度 | 简单 | 复杂（Agent 循环） |
| 适用场景 | 单次收集 | 多轮对话 |
