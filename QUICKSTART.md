# WanyanAI - 快速开始

AI 驱动的文本诊断平台：提交文本后，从多维度生成结构化评审报告（小说点评、高考作文评分、歌词评审等）。

## 环境要求

- Node.js 20+
- pnpm 9+（`package.json` 的 `preinstall` 强制仅允许 pnpm）

## 快速启动

```bash
# 1. 安装依赖
pnpm install

# 2. 启动开发服务器（自定义 Node 入口，端口 5000）
pnpm dev
```

访问 http://localhost:5000。

## 生产构建与启动

```bash
# 构建（安装依赖 → next build → tsup 打包 src/server.ts 为 dist/server.js）
pnpm build

# 启动生产服务器（校验 dist/server.js 存在后执行）
pnpm start
```

## 模型密钥配置

模型密钥放在 `keys/` 目录下，以 JSON 文件形式管理（非 `.env`）：

```json
// keys/deepseek.json
{
  "apiKey": "sk-xxx",
  "baseUrl": "https://api.deepseek.com/v1",
  "model": "deepseek-chat"
}
```

- 参考现有文件：`keys/deepseek.json`、`keys/qwen3.json`、`keys/qwen3.5.json`
- 平台配置入口：`platform-config/forward.json`（模型转发配置）、`platform-config/manifest.json`（版本信息）

## 常用脚本

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 开发模式（`tsx watch src/server.ts`，自动清理 5000 端口占用） |
| `pnpm build` | 生产构建（next build + tsup 服务端打包） |
| `pnpm start` | 生产启动（`node dist/server.js`） |
| `pnpm lint` | ESLint 检查 |
| `pnpm ts-check` | TypeScript 类型检查 |

## 目录速览

```
src/
├── app/           # Next.js App Router 页面与 API 路由
├── containers/    # 容器注册表（analysis-controls、text-blocks）
├── features/      # 业务功能（agent、controls、output-modes 等）
├── mcp/           # 流式 MCP 客户端（<call> 标签解析 + 工具执行）
├── server/        # 服务端：模块加载、指令编译、输出模式注册表
├── stations/      # 模型中转站适配
├── types/         # 全局类型定义
└── server.ts      # 自定义 Node.js 服务入口
```

模块配置（`app-modules/<module-id>/`）与平台配置（`platform-config/`）均为 JSON 驱动，详见 [README.md](./README.md)。

## 常见问题

**Q: 端口被占用怎么办？**

A: `pnpm dev` 会自动清理 5000 端口占用；也可通过环境变量覆盖：

```bash
$env:PORT=3000; pnpm dev   # PowerShell
```

**Q: 如何新增一个评估模块？**

A: 在 `app-modules/` 下创建目录并编写 `main.json` 即可被自动加载，详细步骤见 [docs/adding-a-module.md](./docs/adding-a-module.md)。

**Q: 如何更新依赖？**

A: 使用 pnpm（禁止 npm/yarn）：

```bash
pnpm update
```

## 详细文档

- 部署：`DEPLOYMENT.md`（Linux/通用）、`WINDOWS_DEPLOYMENT.md`（Windows）
- 扩展指南：`docs/adding-a-module.md`、`docs/adding-a-control.md`、`docs/adding-a-container.md`、`docs/adding-an-output-mode.md`
- 架构：`ARCHITECTURE_ANALYSIS.md`、`OUTPUT_MODES_ARCHITECTURE.md`
