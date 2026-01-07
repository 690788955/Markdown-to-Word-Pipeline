#!/bin/bash
# ==========================================
# 更新 Eisvogel LaTeX 模板
# 用于解决 Pandoc 版本兼容性问题
# ==========================================

set -e

echo "=========================================="
echo "更新 Eisvogel LaTeX 模板"
echo "=========================================="
echo ""

# 确定模板目录
if [[ "$OSTYPE" == "darwin"* ]]; then
    TEMPLATE_DIR="$HOME/.local/share/pandoc/templates"
else
    TEMPLATE_DIR="$HOME/.local/share/pandoc/templates"
fi

EISVOGEL_PATH="$TEMPLATE_DIR/eisvogel.latex"

# 创建目录
if [ ! -d "$TEMPLATE_DIR" ]; then
    echo "创建模板目录: $TEMPLATE_DIR"
    mkdir -p "$TEMPLATE_DIR"
fi

# 检查现有版本
if [ -f "$EISVOGEL_PATH" ]; then
    echo "现有模板: $EISVOGEL_PATH"
    echo "  修改时间: $(stat -c %y "$EISVOGEL_PATH" 2>/dev/null || stat -f %Sm "$EISVOGEL_PATH")"
    echo "  文件大小: $(stat -c %s "$EISVOGEL_PATH" 2>/dev/null || stat -f %z "$EISVOGEL_PATH") bytes"
    
    # 备份现有文件
    BACKUP_PATH="$EISVOGEL_PATH.backup"
    cp "$EISVOGEL_PATH" "$BACKUP_PATH"
    echo "  已备份到: $BACKUP_PATH"
    echo ""
fi

# 下载最新版本
DOWNLOAD_URL="https://raw.githubusercontent.com/Wandmalfarbe/pandoc-latex-template/master/eisvogel.latex"
echo "下载最新 Eisvogel 模板..."
echo "  URL: $DOWNLOAD_URL"

if command -v curl &> /dev/null; then
    curl -fsSL "$DOWNLOAD_URL" -o "$EISVOGEL_PATH"
elif command -v wget &> /dev/null; then
    wget -q "$DOWNLOAD_URL" -O "$EISVOGEL_PATH"
else
    echo ""
    echo "[错误] 需要 curl 或 wget 来下载文件"
    exit 1
fi

if [ -f "$EISVOGEL_PATH" ]; then
    echo ""
    echo "[成功] 模板已更新!"
    echo "  路径: $EISVOGEL_PATH"
    echo "  大小: $(stat -c %s "$EISVOGEL_PATH" 2>/dev/null || stat -f %z "$EISVOGEL_PATH") bytes"
    echo ""
    echo "现在可以重新尝试生成 PDF 了。"
else
    echo ""
    echo "[错误] 下载失败"
    echo ""
    echo "手动下载步骤:"
    echo "1. 访问: https://github.com/Wandmalfarbe/pandoc-latex-template/releases"
    echo "2. 下载最新版本的 eisvogel.latex"
    echo "3. 复制到: $TEMPLATE_DIR"
    
    # 恢复备份
    if [ -f "$BACKUP_PATH" ]; then
        cp "$BACKUP_PATH" "$EISVOGEL_PATH"
        echo ""
        echo "已恢复备份文件"
    fi
    exit 1
fi
