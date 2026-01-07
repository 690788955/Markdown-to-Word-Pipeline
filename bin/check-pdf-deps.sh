#!/bin/bash
# ==========================================
# PDF 依赖检查脚本 (Linux/macOS)
# ==========================================

set -e

QUIET=false

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

usage() {
    cat << EOF
PDF 依赖检查脚本

用法: ./bin/check-pdf-deps.sh [-q|--quiet] [-h|--help]

参数:
  -q, --quiet    静默模式，仅在有缺失依赖时输出
  -h, --help     显示此帮助信息

检查项目:
  - Pandoc: 文档转换引擎
  - XeLaTeX: PDF 生成引擎
  - Eisvogel: LaTeX 模板
  - 中文字体: Noto Sans CJK 或其他中文字体
EOF
}

# 解析参数
while [[ $# -gt 0 ]]; do
    case $1 in
        -q|--quiet)
            QUIET=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "未知参数: $1"
            usage
            exit 1
            ;;
    esac
done

# 检测操作系统
OS="unknown"
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
fi

MISSING=()
WARNINGS=()

print_status() {
    local name="$1"
    local found="$2"
    local info="$3"
    
    if [ "$QUIET" = false ]; then
        if [ "$found" = true ]; then
            if [ -n "$info" ]; then
                echo -e "${GREEN}[OK]${NC} $name ($info)"
            else
                echo -e "${GREEN}[OK]${NC} $name"
            fi
        else
            echo -e "${RED}[缺失]${NC} $name"
        fi
    fi
}

if [ "$QUIET" = false ]; then
    echo "=========================================="
    echo "PDF 依赖检查"
    echo "=========================================="
    echo ""
fi

# 检查 Pandoc
if command -v pandoc &> /dev/null; then
    PANDOC_VERSION=$(pandoc --version | head -n 1 | sed 's/pandoc //')
    print_status "Pandoc" true "$PANDOC_VERSION"
else
    print_status "Pandoc" false
    if [ "$OS" = "linux" ]; then
        MISSING+=("Pandoc|sudo apt install pandoc|https://pandoc.org/installing.html")
    else
        MISSING+=("Pandoc|brew install pandoc|https://pandoc.org/installing.html")
    fi
fi

# 检查 XeLaTeX
if command -v xelatex &> /dev/null; then
    XELATEX_VERSION=$(xelatex --version | head -n 1)
    print_status "XeLaTeX" true "$XELATEX_VERSION"
else
    print_status "XeLaTeX" false
    if [ "$OS" = "linux" ]; then
        MISSING+=("XeLaTeX|sudo apt install texlive-xetex texlive-fonts-recommended|https://www.tug.org/texlive/")
    else
        MISSING+=("XeLaTeX|brew install --cask mactex|https://www.tug.org/mactex/")
    fi
fi

# 检查 Eisvogel 模板
EISVOGEL_FOUND=false
EISVOGEL_PATH=""

TEMPLATE_PATHS=(
    "$HOME/.local/share/pandoc/templates/eisvogel.latex"
    "$HOME/.pandoc/templates/eisvogel.latex"
    "/usr/share/pandoc/data/templates/eisvogel.latex"
)

for path in "${TEMPLATE_PATHS[@]}"; do
    if [ -f "$path" ]; then
        EISVOGEL_FOUND=true
        EISVOGEL_PATH="$path"
        break
    fi
done

if [ "$EISVOGEL_FOUND" = true ]; then
    print_status "Eisvogel 模板" true "$EISVOGEL_PATH"
else
    print_status "Eisvogel 模板" false
    INSTALL_CMD='mkdir -p ~/.local/share/pandoc/templates && wget -O ~/.local/share/pandoc/templates/eisvogel.latex https://raw.githubusercontent.com/Wandmalfarbe/pandoc-latex-template/master/eisvogel.latex'
    MISSING+=("Eisvogel 模板|$INSTALL_CMD|https://github.com/Wandmalfarbe/pandoc-latex-template")
fi

# 检查中文字体
FONT_FOUND=false
FOUND_FONT=""

check_font() {
    local font_name="$1"
    if command -v fc-list &> /dev/null; then
        if fc-list | grep -qi "$font_name"; then
            return 0
        fi
    fi
    return 1
}

FONT_NAMES=(
    "Noto Sans CJK"
    "Noto Sans CJK SC"
    "Source Han Sans"
    "WenQuanYi"
    "PingFang"
    "Hiragino Sans"
)

for font in "${FONT_NAMES[@]}"; do
    if check_font "$font"; then
        FONT_FOUND=true
        FOUND_FONT="$font"
        break
    fi
done

if [ "$FONT_FOUND" = true ]; then
    print_status "中文字体" true "$FOUND_FONT"
else
    print_status "中文字体" false
    if [ "$OS" = "linux" ]; then
        WARNINGS+=("中文字体|未检测到中文字体，PDF 可能无法正确显示中文|sudo apt install fonts-noto-cjk")
    else
        WARNINGS+=("中文字体|未检测到中文字体，PDF 可能无法正确显示中文|brew install font-noto-sans-cjk")
    fi
fi

# 输出结果
if [ "$QUIET" = false ]; then
    echo ""
fi

if [ ${#MISSING[@]} -gt 0 ]; then
    echo "=========================================="
    echo "缺失依赖安装指南"
    echo "=========================================="
    echo ""
    
    for item in "${MISSING[@]}"; do
        IFS='|' read -r name install url <<< "$item"
        echo -e "${YELLOW}[$name]${NC}"
        echo "安装命令:"
        echo -e "  ${CYAN}$install${NC}"
        echo "官方文档: $url"
        echo ""
    done
    
    exit 1
fi

if [ ${#WARNINGS[@]} -gt 0 ]; then
    echo "=========================================="
    echo "警告"
    echo "=========================================="
    echo ""
    
    for item in "${WARNINGS[@]}"; do
        IFS='|' read -r name message install <<< "$item"
        echo -e "${YELLOW}[$name]${NC}"
        echo "$message"
        echo -e "建议: ${CYAN}$install${NC}"
        echo ""
    done
fi

if [ ${#MISSING[@]} -eq 0 ]; then
    if [ "$QUIET" = false ]; then
        echo "=========================================="
        echo -e "${GREEN}所有 PDF 依赖已就绪！${NC}"
        echo "=========================================="
    fi
    exit 0
fi
