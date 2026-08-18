# WanyanAI - 部署指南

## 项目概述

WanyanAI 是 AI 驱动的文本诊断平台，支持小说点评、高考作文评分、歌词评审等模块。技术栈：Next.js 16 (App Router) + React 19 + TypeScript 5 + pnpm。

## 构建与运行方式（重要）

本项目**不使用**标准 Next.js 独立部署方式（`next start`），而是通过**自定义 Node.js 入口**提供服务：

1. `pnpm build` 分两步完成构建：
   - `next build`：构建前端页面与 API 路由
   - `tsup src/server.ts`：将自定义服务端入口打包为 `dist/server.js`（CJS，Node 20 目标）
2. `pnpm start` 校验 `dist/server.js` 存在后执行 `node dist/server.js`：
   - 创建 `http.Server` 并挂载 Next.js 请求处理器
   - 默认监听 `0.0.0.0:5000`（`PORT` 环境变量可覆盖）
   - 开发/生产模式由 `COZE_PROJECT_ENV` 决定（非 `PROD` 时视为开发模式）

## 前置要求

- Node.js 20+
- pnpm 9+

## 部署步骤

### 1. 上传项目文件

将整个项目上传到服务器（保留 `package.json`、`pnpm-lock.yaml`、`src/`、`public/`、`app-modules/`、`platform-config/`、`keys/` 等）。

### 2. 安装依赖

```bash
pnpm install
```

> 依赖锁定在 `pnpm-lock.yaml`，建议使用 `pnpm install --frozen-lockfile`。

### 3. 配置模型密钥

模型密钥位于 `keys/` 目录（JSON 格式），部署时需提供有效的密钥文件：

```
keys/
├── deepseek.json
├── qwen3.json
└── qwen3.5.json
```

密钥通过 `platform-config/forward.json` 等平台配置被引用，缺失密钥会导致模型调用失败。

### 4. 构建

```bash
pnpm run build
```

产物：
- `.next/`：Next.js 构建输出
- `dist/server.js`：自定义服务端入口（`pnpm start` 依赖此文件）

### 5. 启动生产环境

```bash
pnpm run start
```

默认服务地址：`http://localhost:5000`。

### 6.（可选）环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | HTTP 监听端口 | `5000` |
| `HOSTNAME` | 监听地址 | `localhost` |
| `COZE_PROJECT_ENV` | `PROD` 表示生产模式（否则视为开发模式） | 无 |
| `COZE_WORKSPACE_PATH` | 工作区路径（Coze 平台脚本使用，默认当前目录） | `$(pwd)` |

## Coze 平台部署

`scripts/` 下提供了 Coze 平台兼容的部署脚本：

```bash
./scripts/prepare.sh    # 安装依赖（pnpm install）
./scripts/build.sh      # 安装依赖 + next build + tsup 打包
./scripts/start.sh      # 启动 dist/server.js（PORT=5000）
```

## 使用 PM2 进行进程管理（推荐）

```bash
npm install -g pm2

# 启动服务
pm2 start "pnpm run start" --name wanyanai

# 常用命令
pm2 status
pm2 logs wanyanai
pm2 restart wanyanai
pm2 save
pm2 startup   # 开机自启（按提示执行输出命令）
```

## 反向代理（Nginx）

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

HTTPS 可使用 certbot：

```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## 故障排除

### 端口被占用

```bash
PORT=3000 pnpm run start
```

### `dist/server.js` 不存在

`pnpm start` 会直接报错退出，需先执行 `pnpm run build`。

### 模型调用失败

- 检查 `keys/` 下的密钥文件是否有效
- 检查 `platform-config/forward.json` 转发配置
- 检查权限服务（`platform-config/permission-service.json`）是否可达（认证服务不可用时系统自动降级为游客访问）

### 依赖安装失败

```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### 构建失败

- 确认 Node.js >= 20：`node -v`
- 确认使用 pnpm（npm/yarn 会被 `preinstall` 拦截）

## 安全建议

1. **使用 HTTPS**：生产环境务必启用
2. **防火墙配置**：只开放必要的端口（默认 5000）
3. **密钥保护**：`keys/` 目录包含敏感信息，勿提交到公开仓库或暴露在静态目录
4. **日志监控**：定期检查应用日志（服务端使用 pino 日志）

## 相关文档

- Windows 部署：`WINDOWS_DEPLOYMENT.md`
- 快速开始：`QUICKSTART.md`
