# AI 文本完成度诊断系统 - 快速开始

## 📦 项目已完成！

您的AI文本完成度诊断系统已经准备就绪！

## 🚀 快速部署

### 方法一：使用部署脚本（推荐）

```bash
# 1. 解压压缩包
tar -xzf ai-text-diagnosis-system.tar.gz
cd ai-text-diagnosis-system

# 2. 运行自动部署脚本
chmod +x deploy.sh
./deploy.sh

# 3. 启动服务
pnpm run start
```

### 方法二：手动部署

```bash
# 1. 解压并进入项目目录
tar -xzf ai-text-diagnosis-system.tar.gz
cd ai-text-diagnosis-system

# 2. 安装依赖
pnpm install

# 3. 构建项目
pnpm run build

# 4. 启动服务
pnpm run start
```

## 🌐 访问应用

启动成功后，在浏览器中访问：

```
http://localhost:5000
```

## 📋 功能特性

✅ **文本输入** - 支持粘贴各种类型的文本内容  
✅ **智能配置** - 可选择文本类型、完整度、评价目标等  
✅ **多维度分析** - 结构、节奏、人物、冲突等7个维度  
✅ **结构化报告** - 直观的仪表盘、评分、问题列表  
✅ **报告导出** - 支持JSON格式导出  

## 📁 项目结构

```
ai-text-diagnosis-system/
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── page.tsx      # 主页面
│   │   ├── layout.tsx    # 布局
│   │   └── globals.css   # 全局样式
│   ├── components/        # React组件
│   │   └── ReportView.tsx # 报告查看组件
│   ├── services/          # 业务逻辑
│   │   └── aiAnalysis.ts  # AI分析服务
│   └── types/             # TypeScript类型
│       └── report.ts      # 报告类型定义
├── public/                # 静态资源
├── package.json           # 项目配置
├── DEPLOYMENT.md          # 详细部署文档
├── QUICKSTART.md          # 本文档
└── deploy.sh              # 自动部署脚本
```

## 🛠️ 技术栈

- **框架**: Next.js 16 (App Router)
- **语言**: TypeScript 5
- **UI组件**: shadcn/ui + Radix UI
- **样式**: Tailwind CSS 4
- **包管理**: pnpm

## 🔧 配置说明

### 修改端口

在项目根目录创建 `.env` 文件：

```env
PORT=3000
```

### 使用PM2进程管理

```bash
# 安装PM2
npm install -g pm2

# 启动服务
pm2 start "pnpm run start" --name ai-text-diagnosis

# 查看状态
pm2 status

# 查看日志
pm2 logs ai-text-diagnosis

# 设置开机自启
pm2 startup
pm2 save
```

## 📖 详细文档

- **部署指南**: 请查看 `DEPLOYMENT.md` 获取完整的部署说明
- **项目说明**: 请查看 `README.md` 了解项目详情

## 🎯 使用流程

1. **输入文本** - 在文本框中粘贴您的作品
2. **配置分析** - 选择文本类型、评价目标等参数
3. **开始分析** - 点击"开始分析"按钮
4. **查看报告** - 浏览结构化的分析报告
5. **导出保存** - 下载JSON格式的报告文件

## 💡 常见问题

**Q: 端口被占用怎么办？**

A: 修改 `.env` 文件中的端口号，或使用：
```bash
PORT=3000 pnpm run start
```

**Q: 如何更新依赖？**

A: 运行：
```bash
pnpm update
```

**Q: 支持哪些文本类型？**

A: 支持网络连载、短篇小说、轻小说、文学投稿、通用文本等多种类型。

## 📞 获取帮助

如有问题，请查看：
1. `DEPLOYMENT.md` - 详细部署文档
2. `README.md` - 项目说明文档

## 🎉 开始使用

现在，您可以运行 `./deploy.sh` 开始部署您的AI文本诊断系统了！

祝您使用愉快！
