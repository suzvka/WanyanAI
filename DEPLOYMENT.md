# AI 文本完成度诊断系统 - 部署指南

## 项目概述

这是一个基于 Next.js 的 AI 文本完成度诊断系统，为创作者提供投稿/发布前的专业文本质量评估。

## 技术栈

- **框架**: Next.js 16 (App Router)
- **语言**: TypeScript 5
- **UI 组件**: shadcn/ui
- **样式**: Tailwind CSS 4
- **包管理器**: pnpm

## 前置要求

确保您的服务器已安装以下软件：

- Node.js 20+ 
- pnpm 9+

## 部署步骤

### 1. 上传项目文件

将整个项目文件夹上传到您的服务器。

### 2. 安装依赖

在项目根目录下执行：

```bash
pnpm install
```

### 3. 构建项目

```bash
pnpm run build
```

### 4. 启动生产环境

```bash
pnpm run start
```

默认情况下，服务将在 `http://localhost:5000` 启动。

## 环境变量配置

如需修改端口或其他配置，可以创建 `.env` 文件：

```env
# 服务端口
PORT=5000

# 其他环境变量
NODE_ENV=production
```

## 使用 PM2 进行进程管理（推荐）

为了确保服务持续运行，推荐使用 PM2：

### 安装 PM2

```bash
npm install -g pm2
```

### 启动服务

```bash
pm2 start "pnpm run start" --name ai-text-diagnosis
```

### 查看状态

```bash
pm2 status
```

### 查看日志

```bash
pm2 logs ai-text-diagnosis
```

### 设置开机自启

```bash
pm2 startup
pm2 save
```

## 反向代理配置（推荐使用 Nginx）

### Nginx 配置示例

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
        proxy_cache_bypass $http_upgrade;
        
        # WebSocket 支持（如需要）
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 启用 HTTPS（推荐）

使用 Let's Encrypt 免费证书：

```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## Docker 部署（可选）

如果您 prefer Docker 部署，可以创建以下文件：

### Dockerfile

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN npm install -g pnpm && pnpm install

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm install -g pnpm && pnpm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 5000
CMD ["node", "server.js"]
```

### docker-compose.yml

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
    restart: unless-stopped
```

## 功能说明

### 主要功能

1. **文本输入**: 支持粘贴各种类型的文本内容
2. **分析配置**: 
   - 文本类型选择（网络连载、短篇小说、文学投稿等）
   - 文本完整度设置
   - 评价目标选择
   - 读者偏好配置
   - 反馈风格调整
3. **AI 分析**: 模拟多维度文本质量评估
4. **结构化报告**: 生成包含评分、问题、建议的完整报告
5. **报告导出**: 支持 JSON 格式导出

### 报告结构

- 总体评分和等级
- 发布建议
- 核心问题列表（按优先级）
- 分维度详细分析
- 优势和改进空间

## 自定义配置

### 修改默认端口

编辑 `next.config.ts` 或 `.env` 文件中的端口配置。

### 调整 AI 分析逻辑

修改 `src/services/aiAnalysis.ts` 文件来自定义分析算法。

### 自定义主题和样式

修改 `src/app/globals.css` 和组件中的 Tailwind 类名。

## 故障排除

### 端口被占用

如果 5000 端口被占用，可以修改为其他端口：

```bash
PORT=3000 pnpm run start
```

### 依赖安装失败

尝试清除缓存后重新安装：

```bash
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### 构建失败

确保 Node.js 版本符合要求：

```bash
node -v
# 应该 >= 20
```

## 安全建议

1. **使用 HTTPS**: 生产环境务必启用 HTTPS
2. **防火墙配置**: 只开放必要的端口
3. **定期更新**: 保持依赖包和系统的更新
4. **日志监控**: 定期检查应用日志
5. **备份策略**: 定期备份重要数据

## 许可证

本项目仅供学习和个人使用。

## 技术支持

如有问题，请查看项目文档或提交 Issue。
