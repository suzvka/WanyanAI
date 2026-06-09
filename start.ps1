# WanyanAI 生产模式启动 (PowerShell + Conda)
param([string]$EnvName = "wanyanai")

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  WanyanAI - 生产模式启动" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# 激活 conda 环境
Write-Host "[1/4] 激活 conda 环境: $EnvName" -ForegroundColor Yellow
$initScript = & conda shell.powershell hook 2>$null | Out-String
if ($initScript) { Invoke-Expression $initScript }
conda activate $EnvName
if ($LASTEXITCODE -ne 0) {
    Write-Host "错误: 无法激活 conda 环境 '$EnvName'" -ForegroundColor Red
    exit 1
}
Write-Host "  conda 环境已激活" -ForegroundColor Green

# 检查依赖
Write-Host "[2/4] 检查依赖..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules")) {
    Write-Host "  正在安装依赖..." -ForegroundColor Gray
    pnpm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "错误: 依赖安装失败" -ForegroundColor Red
        exit 1
    }
}
Write-Host "  依赖已就绪" -ForegroundColor Green

# 检查构建产物
Write-Host "[3/4] 检查构建产物..." -ForegroundColor Yellow
if (-not (Test-Path "dist/server.js")) {
    Write-Host "  正在构建项目..." -ForegroundColor Gray
    pnpm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "错误: 构建失败" -ForegroundColor Red
        exit 1
    }
}
Write-Host "  构建产物已就绪" -ForegroundColor Green

# 启动生产服务
Write-Host "[4/4] 启动生产服务..." -ForegroundColor Yellow
Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  访问地址: http://localhost:5000" -ForegroundColor Cyan
Write-Host "  按 Ctrl+C 停止服务" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
pnpm run start
