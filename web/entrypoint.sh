#!/bin/bash
# ==========================================
# Docker 容器启动脚本
# ==========================================
# 在启动应用前刷新字体缓存（支持挂载自定义字体）

set -e

echo "[Entrypoint] 运维文档生成系统启动中..."

# 检查是否有自定义字体
if [ -d "/app/fonts" ] && [ "$(ls -A /app/fonts/*.ttf /app/fonts/*.otf 2>/dev/null)" ]; then
    echo "[Entrypoint] 检测到自定义字体，刷新字体缓存..."
    fc-cache -fv > /dev/null 2>&1
    echo "[Entrypoint] 字体缓存已更新"
else
    echo "[Entrypoint] 未检测到自定义字体，使用系统默认字体"
fi

# 启动应用
echo "[Entrypoint] 启动 Web 服务 (端口: ${PORT:-8080})..."
exec /app/doc-generator-web "$@"
