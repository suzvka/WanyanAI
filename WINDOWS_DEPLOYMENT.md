# WanyanAI - Windows 部署指南

> 本文档基于仓库内已有的 Windows 脚本（`setup.ps1` / `dev.ps1` / `start.ps1`）编写，
> 与实际实现保持一致。若与代码不一致，以代码为准。

## 📋 前提条件

- Windows 10/11（PowerShell 5.1+）
- 已安装 Anaconda / Miniconda（脚本依赖 conda 管理 Node.js 环境）

---

## 🚀 一键部署（推荐）

仓库已提供三份 PowerShell 脚本（conda 感知，自动创建/激活 `wanyanai` 环境）：

### 1. 环境准备（首次部署执行）

```powershell
# 在项目根目录执行
.\setup.ps1
```

脚本自动完成：
1. 检查 conda 是否可用
2. 创建 conda 环境 `wanyanai`（内含 nodejs 20，可用参数覆盖：`.\setup.ps1 -EnvName myenv`）
3. 安装 pnpm@9 到该环境
4. 执行 `pnpm install` 安装项目依赖

### 2. 生产模式启动

```powershell
.\start.ps1
```

脚本自动完成：
1. 激活 conda 环境 `wanyanai`
2. 检查 `node_modules`（缺失则自动安装）
3. 检查 `dist/server.js`（缺失则自动执行 `pnpm run build`）
4. 执行 `pnpm run start`（`node dist/server.js`，端口 5000）

### 3. 开发模式启动

```powershell
.\dev.ps1
```

激活环境并执行 `pnpm run dev`（`tsx watch src/server.ts`，自动清理 5000 端口占用）。

---

## 🔧 手动部署步骤

### 1. 安装 Node.js 与 pnpm

```powershell
# 推荐使用 conda 管理（与脚本一致）
conda create -n wanyanai nodejs=20 -y
conda activate wanyanai
npm install -g pnpm@9
```

或直接安装 Node.js LTS（20+）与 pnpm。

### 2. 安装依赖

```powershell
pnpm install
```

### 3. 配置模型密钥

在 `keys/` 目录提供有效密钥文件（`deepseek.json`、`qwen3.json` 等），参考现有文件格式。

### 4. 构建

```powershell
pnpm run build
```

构建分两步：`next build`（前端）+ `tsup src/server.ts`（自定义服务端入口 → `dist/server.js`）。

### 5. 启动

```powershell
pnpm run start
```

访问 http://localhost:5000。

---

## 🔥 防火墙配置（服务器场景）

允许 5000 端口入站（管理员 PowerShell）：

```powershell
New-NetFirewallRule -DisplayName "WanyanAI Service" -Direction Inbound -LocalPort 5000 -Protocol TCP -Action Allow
```

局域网访问：`http://服务器IP:5000`；公网访问需配置端口转发或云安全组。

---

## ⚠️ 遗留说明

仓库根目录同时存在 `setup.bat` / `start.bat` / `dev.bat`（批处理版本），
内容仍为旧项目（"AI 文本完成度诊断系统"）的占位脚本，**未适配当前项目**。
请优先使用 `.ps1` 脚本；`.bat` 脚本在适配前请勿使用。

---

## 🛠️ 常见问题

### pnpm 命令找不到

确认 conda 环境已激活，或检查 npm 全局路径是否在 PATH 中：

```powershell
npm config get prefix
```

### 端口 5000 被占用

```powershell
# 查找占用进程
netstat -ano | findstr :5000

# 结束进程（PID 替换为实际进程 ID）
taskkill /PID <进程ID> /F
```

或换端口启动：`$env:PORT=3000; pnpm run start`

### 构建失败

```powershell
# 清除缓存重新安装
Remove-Item -Recurse -Force node_modules
Remove-Item pnpm-lock.yaml
pnpm install
pnpm run build
```

### 内存不足

```powershell
$env:NODE_OPTIONS="--max-old-space-size=4096"
pnpm run build
```

---

## 🔒 安全建议

1. 生产环境启用 HTTPS
2. 防火墙只开放必要端口
3. 保护 `keys/` 目录（含敏感密钥，勿公开）
4. 定期更新依赖与 Node.js 版本

## 📞 需要帮助？

- 快速开始：`QUICKSTART.md`
- 通用部署：`DEPLOYMENT.md`
- 项目说明：`README.md`
