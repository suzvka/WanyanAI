#!/bin/bash

# AI文本完成度诊断系统 - 快速部署脚本
# 使用方法: ./deploy.sh

echo "======================================"
echo "AI文本完成度诊断系统 - 部署脚本"
echo "======================================"

# 检查Node.js版本
echo ""
echo "1. 检查环境..."
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未找到Node.js，请先安装Node.js 20+"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "⚠️  警告: Node.js版本较低，建议使用Node.js 20+"
fi

echo "✅ Node.js: $(node -v)"

# 检查pnpm
if ! command -v pnpm &> /dev/null; then
    echo "ℹ️  未找到pnpm，正在安装..."
    npm install -g pnpm
fi

echo "✅ pnpm: $(pnpm -v)"

# 安装依赖
echo ""
echo "2. 安装依赖..."
pnpm install
if [ $? -ne 0 ]; then
    echo "❌ 依赖安装失败"
    exit 1
fi
echo "✅ 依赖安装成功"

# 构建项目
echo ""
echo "3. 构建项目..."
pnpm run build
if [ $? -ne 0 ]; then
    echo "❌ 构建失败"
    exit 1
fi
echo "✅ 构建成功"

echo ""
echo "======================================"
echo "🎉 部署准备完成！"
echo "======================================"
echo ""
echo "下一步操作:"
echo ""
echo "1. 立即启动（开发模式）:"
echo "   pnpm run dev"
echo ""
echo "2. 启动生产环境:"
echo "   pnpm run start"
echo ""
echo "3. 使用PM2管理进程（推荐）:"
echo "   npm install -g pm2"
echo "   pm2 start 'pnpm run start' --name ai-text-diagnosis"
echo ""
echo "4. 查看详细部署文档:"
echo "   请阅读 DEPLOYMENT.md 文件"
echo ""
echo "默认访问地址: http://localhost:5000"
echo ""
