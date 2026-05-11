# Windows 11 服务器版部署指南

## 📋 前提条件检查

您的服务器：Windows 11 服务器版，暂无任何第三方环境

---

## 🚀 完整部署步骤（Windows环境）

### 第一步：安装必要软件

#### 1.1 安装 Node.js

1. 访问 Node.js 官网：https://nodejs.org/
2. 下载 **LTS 版本**（推荐 20.x 或更高版本）
   - 选择 Windows 安装包（.msi）
3. 运行安装程序，按默认设置安装
4. 验证安装：
   ```cmd
   node -v
   npm -v
   ```

#### 1.2 安装 pnpm（推荐）

打开命令提示符（CMD）或 PowerShell，运行：

```cmd
npm install -g pnpm
```

验证安装：
```cmd
pnpm -v
```

---

### 第二步：解压项目文件

#### 2.1 选择安装目录

建议在 `C:\` 盘或 `D:\` 盘创建项目文件夹，例如：
```
C:\ai-text-diagnosis
```

#### 2.2 解压压缩包

1. 右键点击 `ai-text-diagnosis-system.tar.gz`
2. 选择"解压到..."或使用解压软件（如 7-Zip、WinRAR）
3. 解压到您选择的目录

如果没有解压软件，可以：
- 安装 7-Zip：https://www.7-zip.org/
- 或使用 Windows 11 自带的 tar 命令（在 PowerShell 中）：
  ```powershell
  tar -xzf ai-text-diagnosis-system.tar.gz -C C:\ai-text-diagnosis
  ```

---

### 第三步：安装依赖和构建

#### 3.1 打开命令行工具

1. 按 `Win + R`，输入 `cmd` 或 `powershell`
2. 或在项目文件夹中，按住 `Shift` + 右键，选择"在此处打开 PowerShell 窗口"

#### 3.2 进入项目目录

```cmd
cd C:\ai-text-diagnosis
```

#### 3.3 安装依赖

```cmd
pnpm install
```

如果遇到网络问题，可以尝试使用国内镜像：

```cmd
pnpm install --registry=https://registry.npmmirror.com
```

#### 3.4 构建项目

```cmd
pnpm run build
```

---

### 第四步：启动服务

#### 4.1 方式一：直接启动（简单）

```cmd
pnpm run start
```

#### 4.2 方式二：使用 PM2 管理（推荐生产环境）

##### 安装 PM2

```cmd
npm install -g pm2
```

##### 使用 PM2 启动

```cmd
pm2 start "pnpm run start" --name ai-text-diagnosis
```

##### 常用 PM2 命令

```cmd
# 查看状态
pm2 status

# 查看日志
pm2 logs ai-text-diagnosis

# 停止服务
pm2 stop ai-text-diagnosis

# 重启服务
pm2 restart ai-text-diagnosis

# 删除服务
pm2 delete ai-text-diagnosis
```

##### 设置 PM2 开机自启

```cmd
# 1. 保存当前进程
pm2 save

# 2. 生成开机启动脚本
pm2 startup

# 按照提示复制并运行输出的命令
```

---

### 第五步：配置防火墙

#### 5.1 允许端口通过防火墙

1. 打开"Windows Defender 防火墙"
2. 点击"高级设置"
3. 点击"入站规则" → "新建规则"
4. 选择"端口" → "TCP" → "特定本地端口" → 输入 `5000`
5. 选择"允许连接"
6. 全选（域、专用、公用）
7. 名称输入：`AI Text Diagnosis Service`
8. 点击"完成"

或使用 PowerShell 命令（管理员身份）：

```powershell
New-NetFirewallRule -DisplayName "AI Text Diagnosis Service" -Direction Inbound -LocalPort 5000 -Protocol TCP -Action Allow
```

---

### 第六步：访问应用

#### 6.1 本地访问

在服务器浏览器中打开：
```
http://localhost:5000
```

#### 6.2 局域网访问

在局域网内的其他设备上，使用服务器的IP地址访问：
```
http://服务器IP:5000
```

例如：
```
http://192.168.1.100:5000
```

#### 6.3 公网访问（可选）

如果需要从外网访问，需要：
1. 配置端口转发（在路由器中）
2. 或使用内网穿透工具（如 ngrok、frp 等）
3. 或配置云服务器的安全组

---

## 🛠️ 常见问题解决

### 问题1：pnpm 命令找不到

**解决方案：**
```cmd
# 检查 npm 全局安装路径
npm config get prefix

# 将该路径添加到系统环境变量 PATH 中
```

### 问题2：端口 5000 被占用

**解决方案：**

方式一：修改端口
创建 `.env` 文件：
```
PORT=3000
```

方式二：查找并结束占用进程
```cmd
# 查找占用 5000 端口的进程
netstat -ano | findstr :5000

# 结束进程（PID 替换为实际的进程ID）
taskkill /PID <进程ID> /F
```

### 问题3：构建失败

**解决方案：**
```cmd
# 清除缓存重新安装
rmdir /s /q node_modules
del pnpm-lock.yaml
pnpm install
pnpm run build
```

### 问题4：内存不足

**解决方案：**
在构建前增加 Node.js 内存限制：
```cmd
set NODE_OPTIONS=--max-old-space-size=4096
pnpm run build
```

---

## 📁 Windows 专用启动脚本

为了方便您使用，我为您创建两个 Windows 批处理脚本：

### 脚本1：快速启动脚本（start.bat）

创建文件 `start.bat`：

```batch
@echo off
chcp 65001 >nul
echo ======================================
echo AI文本完成度诊断系统 - 启动脚本
echo ======================================
echo.

echo [1/3] 检查 Node.js...
node -v >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误：未找到 Node.js，请先安装 Node.js
    pause
    exit /b 1
)
echo ✅ Node.js 已安装

echo.
echo [2/3] 检查依赖...
if not exist "node_modules" (
    echo 📦 正在安装依赖...
    call pnpm install
    if errorlevel 1 (
        echo ❌ 依赖安装失败
        pause
        exit /b 1
    )
)
echo ✅ 依赖已就绪

echo.
echo [3/3] 启动服务...
echo.
echo ======================================
echo 🚀 服务启动中...
echo 🌐 访问地址：http://localhost:5000
echo ======================================
echo.
call pnpm run start

pause
```

### 脚本2：安装部署脚本（setup.bat）

创建文件 `setup.bat`：

```batch
@echo off
chcp 65001 >nul
echo ======================================
echo AI文本完成度诊断系统 - Windows部署
echo ======================================
echo.

echo 此脚本将帮助您完成以下步骤：
echo 1. 检查并安装必要软件
echo 2. 安装项目依赖
echo 3. 构建项目
echo.
pause

echo.
echo [步骤 1/4] 检查 Node.js...
node -v >nul 2>&1
if errorlevel 1 (
    echo ❌ 未找到 Node.js
    echo.
    echo 请按以下步骤安装：
    echo 1. 访问 https://nodejs.org/
    echo 2. 下载并安装 LTS 版本（20.x 或更高）
    echo 3. 安装完成后重新运行此脚本
    echo.
    pause
    exit /b 1
)
echo ✅ Node.js: 
node -v

echo.
echo [步骤 2/4] 检查 pnpm...
pnpm -v >nul 2>&1
if errorlevel 1 (
    echo ℹ️  正在安装 pnpm...
    call npm install -g pnpm
)
echo ✅ pnpm: 
pnpm -v

echo.
echo [步骤 3/4] 安装项目依赖...
call pnpm install
if errorlevel 1 (
    echo ❌ 依赖安装失败
    echo.
    echo 尝试使用国内镜像...
    call pnpm install --registry=https://registry.npmmirror.com
)
echo ✅ 依赖安装成功

echo.
echo [步骤 4/4] 构建项目...
call pnpm run build
if errorlevel 1 (
    echo ❌ 构建失败
    pause
    exit /b 1
)
echo ✅ 构建成功

echo.
echo ======================================
echo 🎉 部署完成！
echo ======================================
echo.
echo 下一步：
echo 1. 运行 start.bat 启动服务
echo 2. 或运行：pnpm run start
echo.
echo 访问地址：http://localhost:5000
echo.
pause
```

### 使用方法

1. 将这两个脚本文件保存到项目根目录
2. 右键点击 `setup.bat`，选择"以管理员身份运行"
3. 部署完成后，双击 `start.bat` 启动服务

---

## 🔒 安全建议

1. **修改默认端口** - 在生产环境中建议使用非标准端口
2. **配置 HTTPS** - 如果有域名，建议配置 SSL 证书
3. **限制访问IP** - 在防火墙中只允许信任的IP访问
4. **定期更新** - 保持 Node.js 和依赖包的更新
5. **备份数据** - 定期备份重要配置和数据

---

## 📞 需要帮助？

如果遇到问题：
1. 检查命令行窗口的错误信息
2. 确认所有步骤都按顺序执行
3. 查看 `QUICKSTART.md` 和 `DEPLOYMENT.md` 文档

祝您部署顺利！🚀
