@echo off
chcp 65001 >nul
echo ======================================
echo AI文本完成度诊断系统 - 开发模式启动
echo ======================================
echo.

echo [1/3] 检查 Node.js...
node -v >nul 2>&1
if errorlevel 1 (
    echo 错误：未找到 Node.js，请先安装 Node.js
    pause
    exit /b 1
)
echo Node.js 已安装

echo.
echo [2/3] 检查依赖...
if not exist "node_modules" (
    echo 正在安装依赖...
    call pnpm install
    if errorlevel 1 (
        echo 依赖安装失败
        pause
        exit /b 1
    )
)
echo 依赖已就绪

echo.
echo [3/3] 启动开发服务器...
echo.
echo ======================================
echo 开发服务器启动中...
echo 访问地址：http://localhost:5000
echo ======================================
echo.
echo 提示：按 Ctrl+C 可以停止服务
echo.
call pnpm run dev

pause
