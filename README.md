# WanyanAI

AI 驱动的文本诊断平台。提交文本后，系统从多维度生成结构化评审报告——适用于小说点评、高考作文评分、歌词评审等场景。

## 功能模块

| 模块 | 说明 |
|------|------|
| novel-evaluate | 小说作品多维度评审（语言表达、结构逻辑、人物塑造等 6 个维度） |
| gaokao-essay | 高考作文评分（满分 60 分，6 个评分维度） |
| lyrics-evaluate | 歌词创作评审 |

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
│   └── (evaluate)/evaluate/[moduleId]/  # 评测页面
├── components/
│   ├── evaluate/                # 评测页组件
│   ├── layout/                  # 应用框架（侧栏、顶栏）
│   └── ui/                      # shadcn/ui 基础组件
├── containers/                  # 容器注册表（analysis-controls、text-blocks）
├── features/
│   ├── controls/                # 控件模块（select、multi-select）
│   ├── output-modes/            # 输出模式（literary-review、gaokao-essay）
│   └── analysis-controls/       # 分析控制逻辑
├── mcp/                         # 流式 MCP 客户端（单次连接多工具调用）
├── server/                      # 服务端：模块加载、指令编译、输出模式注册表
└── types/                       # 全局类型定义

app-modules/<module-id>/         # 功能模块配置
├── main.json                    # 模块注册（路由、容器、输出模式）
├── controls.json                # 控件定义（选项、默认值、提示词）
└── site.json                    # 页面文案

platform-config/                 # 平台级配置
├── manifest.json                # 版本信息
├── appearance.json              # 品牌与主题
└── feature-flags.json           # 功能开关
```

## 开发规范

- 包管理器：**仅使用 pnpm**
- UI 组件：优先使用 `src/components/ui/` 下的 shadcn/ui 组件
- 新增模块：在 `app-modules/` 下创建目录，编写 `main.json` 即可被自动加载
- 详细工程规范见 [AGENTS.md](./AGENTS.md)
