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
│   │   │   └── report-json/        # 标准 JSON 报告模式
│   │   └── text-blocks/            # 文本块编辑
│   │
│   ├── server/
│   │   ├── config/                 # 平台配置加载
│   │   ├── modules/                # 模块配置加载
│   │   ├── instructions/           # 指令编译
│   │   │   ├── compile.ts          # 动态指令编译
│   │   │   └── prompt-builder.ts   # 提示词编排（新增）
│   │   └── promptBlocks/           # 提示词块加载
│   │
│   ├── types/                      # 类型定义
│   │   ├── module.ts               # 模块类型（含容器配置）
│   │   ├── platform.ts             # 平台类型
│   │   ├── report.ts               # 报告类型
│   │   └── appFlow.ts              # 流程类型
│   │
│   ├── hooks/                      # 自定义 Hooks
│   ├── lib/                        # 工具库
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

### 输出模式系统（新增）

输出模式定义 AI 返回数据的格式和渲染器：

- **report-json**：标准 JSON 报告格式，使用 `ReportView` 渲染

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
   - 定义 `outputMode`（目前支持 `report-json`）
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
  "outputMode": "report-json",
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
| `src/server/modules/loader.ts` | 模块扫描与加载，含容器配置验证 |
| `src/server/modules/schemas.ts` | 模块配置 Schema 验证 |
| `src/server/instructions/prompt-builder.ts` | 提示词编排服务 |
| `src/containers/registry.tsx` | 容器类型注册表 |
| `src/features/output-modes/registry.ts` | 输出模式注册表 |
| `src/components/evaluate/EvaluateClient.tsx` | 统一渲染组件 |
| `src/components/landing/LandingClient.tsx` | 平台首页组件 |
| `src/components/layout/AppSidebar.tsx` | 动态侧栏（根据模块配置渲染） |
