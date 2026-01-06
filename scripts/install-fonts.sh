#!/bin/bash
# 安装项目字体 (Linux/macOS)

set -e

FONTS_DIR="fonts"
USER_FONTS_DIR="$HOME/.local/share/fonts"

# macOS 使用不同的目录
if [[ "$OSTYPE" == "darwin"* ]]; then
    USER_FONTS_DIR="$HOME/Library/Fonts"
fi

# 检查字体目录
if [ ! -d "$FONTS_DIR" ]; then
    echo "[错误] fonts 目录不存在"
    exit 1
fi

# 检查是否有字体文件
FONT_COUNT=$(find "$FONTS_DIR" -maxdepth 1 \( -name "*.otf" -o -name "*.ttf" \) | wc -l)

if [ "$FONT_COUNT" -eq 0 ]; then
    echo "[警告] fonts 目录下没有字体文件"
    echo "请下载字体文件放到 fonts 目录，参考 fonts/README.md"
    exit 0
fi

echo "=========================================="
echo "安装字体"
echo "=========================================="

# 创建用户字体目录
mkdir -p "$USER_FONTS_DIR"

# 复制字体文件
for font in "$FONTS_DIR"/*.otf "$FONTS_DIR"/*.ttf; do
    [ -e "$font" ] || continue
    
    filename=$(basename "$font")
    dest="$USER_FONTS_DIR/$filename"
    
    if [ -f "$dest" ]; then
        echo "  [跳过] $filename (已安装)"
    else
        cp "$font" "$dest"
        echo "  [安装] $filename"
    fi
done

# 刷新字体缓存 (Linux)
if command -v fc-cache &> /dev/null; then
    echo ""
    echo "刷新字体缓存..."
    fc-cache -fv > /dev/null 2>&1
fi

echo ""
echo "完成！"
