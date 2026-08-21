# WanyanAI

AI 驱动的文本诊断平台。提交文本后，系统从多维度生成结构化评审报告——适用于小说点评、高考作文评分、歌词评审等场景。

## 功能模块

| 模块 | 说明 |
|------|------|
| novel-evaluate | 小说作品多维度评审（语言表达、结构逻辑、人物塑造等 6 个维度） |
| gaokao-essay | 高考作文评分（满分 60 分，6 个评分维度） |
| lyrics-evaluate | 歌词创作评审 |
| novel-evaluate-agent | 小说点评（Agent 编排模式） |

每个模块独立配置，运行时自动扫描 `app-modules/` 目录加载。

## 快速开始

```bash
pnpm install
pnpm dev
```

访问 http://localhost:5000。

```bash
# 生产构建
pnpm build
pnpm start
```

## 技术栈

Next.js 16 (App Router) · React 19 · TypeScript 5 · Tailwind CSS 4 · shadcn/ui

## 项目结构

```
src/
├── app/                        # 页面路由
│   ├── (landing)/               # 首页（模块选择）
│   ├── (evaluate)/evaluate/[moduleId]/  # 评测页面
│   └── api/                     # API 路由（v1/chat/completions、v1/models）
├── components/
│   ├── evaluate/                # 评测页组件
│   ├── layout/                  # 应用框架（侧栏、顶栏）
│   └── ui/                      # shadcn/ui 基础组件
├── containers/                  # 容器注册表（analysis-controls、text-blocks）
├── features/
│   ├── agent/                   # Agent 编排（LangChain）
│   ├── controls/                # 控件模块（select、multi-select）
│   ├── output-modes/            # 输出模式（literary-review、gaokao-essay 等）
│   └── analysis-controls/       # 分析控制逻辑
├── mcp/                         # 流式 MCP 客户端（<call> 标签解析 + 工具执行）
├── server/                      # 服务端：模块加载、指令编译、输出模式注册表
├── stations/                    # 模型中转站适配（openai-forward、coze）
├── types/                       # 全局类型定义
└── server.ts                    # 自定义 Node.js 服务入口（next + http）

app-modules/<module-id>/         # 功能模块配置
├── main.json                    # 模块注册（路由、容器、输出模式）
├── controls.json                # 控件定义（选项、默认值、提示词）
├── analysis-controls.json       # 分析控制配置
└── site.json                    # 页面文案

platform-config/                 # 平台级配置
├── manifest.json                # 版本信息
├── appearance.json              # 品牌与主题
├── feature-flags.json           # 功能开关
├── forward.json                 # 模型转发配置
├── permission-service.json      # 权限服务配置
├── rate-limit.json              # 限流配置
└── prompt-blocks/               # 提示词片段（任务总览）

runtime-config/               # 运行时配置数据（DATABASE_PROVIDER=none 时 FileSqlDb 的本地 json，已 gitignore）
keys/                         # 外部模型密钥种子（首次启动导入 ConfigStore 后即不再直接使用）
```

> 注意：本项目通过自定义 Node.js 入口 `src/server.ts`（`pnpm dev` / `pnpm start` 均走此入口）提供 HTTP 服务。外部模型密钥由 ConfigStore 统一管理（渠道由 `DATABASE_PROVIDER` 决定，见 [AGENTS.md](./AGENTS.md)），`keys/` 目录仅作为首次启动时的种子导入源，运行时增删改一律经 Admin 控制台（/admin）。

## 开发规范

- 包管理器：**仅使用 pnpm**
- UI 组件：优先使用 `src/components/ui/` 下的 shadcn/ui 组件
- 新增模块：在 `app-modules/` 下创建目录，编写 `main.json` 即可被自动加载
- 详细工程规范见 [AGENTS.md](./AGENTS.md)
