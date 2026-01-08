#!/bin/bash
# ==========================================
# 修复 Markdown 文件中的图片路径
# ==========================================
# 将 Windows 风格路径 (.\images\) 转换为跨平台路径 (images/)
#
# 使用方式:
#   bash bin/fix-image-paths.sh

set -e

echo "=== 修复 Markdown 图片路径 ==="

# 查找所有包含 .\images\ 的 Markdown 文件
echo "搜索需要修复的文件..."
files=$(find . -name "*.md" -type f -exec grep -l '\.\images\' {} \; 2>/dev/null || true)

if [ -z "$files" ]; then
    echo "✅ 未发现需要修复的文件"
    exit 0
fi

echo "发现以下文件需要修复:"
echo "$files"
echo ""

# 备份并替换
for file in $files; do
    echo "处理: $file"
    # 创建备份
    cp "$file" "$file.bak"
    
    # 替换路径: .\images\ -> images/
    sed -i 's/\.\\\images\\/images\//g' "$file"
    
    # 替换路径: ./images\ -> images/
    sed -i 's/\.\/images\\/images\//g' "$file"
    
    echo "  ✅ 已修复 (备份: $file.bak)"
done

echo ""
echo "=== 修复完成 ==="
echo "如需恢复，可使用备份文件 (*.bak)"
