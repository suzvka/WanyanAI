# WanyanAI 一键环境准备 (PowerShell + Conda)
# 首次克隆项目后运行此脚本
param([string]$EnvName = "wanyanai")

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  WanyanAI - 环境准备" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# 检查 conda
Write-Host "[1/5] 检查 conda..." -ForegroundColor Yellow
$condaCheck = conda --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "错误: 未找到 conda，请先安装 Anaconda/Miniconda" -ForegroundColor Red
    exit 1
}
Write-Host "  conda 可用" -ForegroundColor Green

# 创建/检查 conda 环境
Write-Host "[2/5] 检查 conda 环境: $EnvName" -ForegroundColor Yellow
$envExists = conda env list 2>$null | Select-String "^\s*${EnvName}\s"
if (-not $envExists) {
    Write-Host "  正在创建 conda 环境..." -ForegroundColor Gray
    conda create -n $EnvName nodejs=20 -y
    if ($LASTEXITCODE -ne 0) {
        Write-Host "错误: conda 环境创建失败" -ForegroundColor Red
        exit 1
    }
    Write-Host "  conda 环境已创建" -ForegroundColor Green
} else {
    Write-Host "  conda 环境已存在" -ForegroundColor Green
}

# 激活环境并安装 pnpm
Write-Host "[3/5] 安装 pnpm..." -ForegroundColor Yellow
$initScript = & conda shell.powershell hook 2>$null | Out-String
if ($initScript) { Invoke-Expression $initScript }
conda activate $EnvName
$pnpmCheck = pnpm --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  正在安装 pnpm..." -ForegroundColor Gray
    npm install -g pnpm@9
}
Write-Host "  pnpm 已就绪" -ForegroundColor Green

# 安装项目依赖
Write-Host "[4/5] 安装项目依赖..." -ForegroundColor Yellow
pnpm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "错误: 依赖安装失败" -ForegroundColor Red
    exit 1
}
Write-Host "  依赖安装完成" -ForegroundColor Green

# 完成
Write-Host "[5/5] 环境准备完成！" -ForegroundColor Yellow
Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  后续使用:" -ForegroundColor Cyan
Write-Host "    开发: .\dev.ps1" -ForegroundColor Green
Write-Host "    生产: .\start.ps1" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Cyan
