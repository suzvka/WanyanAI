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
