#!/bin/bash
# ==========================================
# 运维文档生成系统 - 构建脚本
# 支持 Word 和 PDF 格式输出
# ==========================================

set -e

# 确定脚本所在目录和工作目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ "$(basename "$SCRIPT_DIR")" = "bin" ]; then
    BASE_DIR="$(dirname "$SCRIPT_DIR")"
else
    BASE_DIR="$SCRIPT_DIR"
fi

# 默认参数
CLIENT="default"
DOC_TYPE=""
CUSTOM_CLIENT_NAME=""
FORMAT="word"
WORK_DIR=""
SHOW_HELP=false
LIST_CLIENTS=false
LIST_DOCS=false
CHECK_PDF_DEPS=false

# 解析命名参数
while [[ $# -gt 0 ]]; do
    case $1 in
        -c|--client)
            CLIENT="$2"
            shift 2
            ;;
        -d|--doc)
            DOC_TYPE="$2"
            shift 2
            ;;
        -n|--name)
            CUSTOM_CLIENT_NAME="$2"
            shift 2
            ;;
        -f|--format)
            FORMAT="$2"
            shift 2
            ;;
        -w|--workdir)
            WORK_DIR="$2"
            shift 2
            ;;
        -h|--help)
            SHOW_HELP=true
            shift
            ;;
        --list-clients)
            LIST_CLIENTS=true
            shift
            ;;
        --list-docs)
            LIST_DOCS=true
            shift
            ;;
        --check-pdf-deps)
            CHECK_PDF_DEPS=true
            shift
            ;;
        *)
            # 兼容旧的位置参数
            if [ -z "$CLIENT" ] || [ "$CLIENT" = "default" ]; then
                CLIENT="$1"
            elif [ -z "$DOC_TYPE" ]; then
                DOC_TYPE="$1"
            elif [ -z "$CUSTOM_CLIENT_NAME" ]; then
                CUSTOM_CLIENT_NAME="$1"
            elif [ "$FORMAT" = "word" ]; then
                FORMAT="$1"
            fi
            shift
            ;;
    esac
done

# 设置工作目录
if [ -n "$WORK_DIR" ]; then
    BASE_DIR="$WORK_DIR"
fi

cd "$BASE_DIR"

# 配置（相对于工作目录）
SRC_DIR="src"
CLIENTS_DIR="clients"
TEMPLATES_DIR="templates"
BUILD_DIR="build"

# ==========================================
# 帮助信息
# ==========================================
show_help() {
    cat << EOF
==========================================
运维文档生成系统 (Linux/macOS)
==========================================

用法: ./build.sh [选项]

选项:
  -c, --client <名称>    指定客户配置（默认: default）
  -d, --doc <文档类型>   指定文档类型（如：运维手册、部署手册）
  -n, --name <名称>      自定义客户名称（覆盖配置）
  -f, --format <格式>    输出格式：word 或 pdf（默认: word）
  -w, --workdir <目录>   指定工作目录
  -h, --help             显示帮助信息
  --list-clients         列出所有可用客户配置
  --list-docs            列出指定客户的所有文档类型
  --check-pdf-deps       检查 PDF 生成所需依赖

示例:
  ./build.sh                                      # 默认构建 Word
  ./build.sh -f pdf                               # 生成 PDF
  ./build.sh -c 标准文档 -d 运维手册              # 构建运维手册
  ./build.sh -c 标准文档 -d 运维手册 -f pdf       # 生成 PDF 格式
  ./build.sh --list-clients                       # 列出所有客户
  ./build.sh -c 标准文档 --list-docs              # 列出文档类型
  ./build.sh --check-pdf-deps                     # 检查 PDF 依赖

工作目录: $BASE_DIR

EOF
}

# ==========================================
# 列出客户
# ==========================================
list_clients() {
    echo "可用客户配置:"
    for dir in ${CLIENTS_DIR}/*/; do
        if [ -d "$dir" ]; then
            echo "  - $(basename "$dir")"
        fi
    done
}

# ==========================================
# 列出文档类型
# ==========================================
list_docs() {
    local client_dir="${CLIENTS_DIR}/${CLIENT}"
    if [ ! -d "$client_dir" ]; then
        echo "[错误] 客户不存在: $CLIENT"
        return 1
    fi
    
    echo "客户 [$CLIENT] 的文档类型:"
    for f in ${client_dir}/*.yaml; do
        if [ -f "$f" ]; then
            name=$(basename "$f" .yaml)
            if [ "$name" = "metadata" ]; then
                continue
            fi
            echo "  - $name"
        fi
    done
}

# ==========================================
# 辅助函数
# ==========================================

# 从 YAML 读取单个值
read_yaml_value() {
    local file="$1"
    local key="$2"
    
    if [ ! -f "$file" ]; then
        echo ""
        return
    fi
    
    grep "^${key}:" "$file" 2>/dev/null | head -1 | sed "s/^${key}:[[:space:]]*[\"']*\([^\"']*\)[\"']*.*/\1/"
}

# 从 YAML 读取列表
read_yaml_list() {
    local file="$1"
    local key="$2"
    
    if [ ! -f "$file" ]; then
        echo ""
        return
    fi
    
    awk -v key="$key" '
        $0 ~ "^"key":" { in_list=1; next }
        in_list && /^[[:space:]]*#/ { next }  # 跳过注释行
        in_list && /^[[:space:]]+-/ { 
            gsub(/^[[:space:]]+-[[:space:]]*/, "")
            gsub(/["'\'']/, "")
            print
        }
        in_list && /^[^[:space:]]/ { exit }  # 遇到非缩进行退出
    ' "$file"
}

# 从 YAML 读取 pdf_options 节
read_pdf_option() {
    local file="$1"
    local key="$2"
    local default="$3"
    
    if [ ! -f "$file" ]; then
        echo "$default"
        return
    fi
    
    local value
    value=$(awk -v key="$key" '
        /^pdf_options:/ { in_section=1; next }
        in_section && /^[^[:space:]]/ { exit }
        in_section && $0 ~ "^[[:space:]]+"key":" {
            gsub(/^[[:space:]]+'"$key"':[[:space:]]*/, "")
            gsub(/["'\'']/, "")
            print
            exit
        }
    ' "$file")
    
    if [ -n "$value" ]; then
        echo "$value"
    else
        echo "$default"
    fi
}

# 替换占位符
replace_placeholders() {
    local pattern="$1"
    local client_name="$2"
    local title="$3"
    local version="$4"
    local date="$5"
    
    echo "$pattern" | \
        sed "s/{client}/${client_name}/g" | \
        sed "s/{title}/${title}/g" | \
        sed "s/{version}/${version}/g" | \
        sed "s/{date}/${date}/g"
}

# ==========================================
# PDF 依赖检查
# ==========================================
check_pdf_dependencies() {
    local all_ok=true
    
    echo "检查 PDF 生成依赖..."
    echo ""
    
    # 检查 Pandoc
    if command -v pandoc &> /dev/null; then
        echo "[OK] Pandoc 已安装: $(which pandoc)"
    else
        echo "[错误] Pandoc 未安装"
        echo "  安装: sudo apt install pandoc (Ubuntu) 或 brew install pandoc (macOS)"
        all_ok=false
    fi
    
    # 检查 XeLaTeX
    if command -v xelatex &> /dev/null; then
        echo "[OK] XeLaTeX 已安装: $(which xelatex)"
    else
        echo "[错误] XeLaTeX 未安装"
        echo "  安装: sudo apt install texlive-xetex (Ubuntu) 或 brew install --cask mactex (macOS)"
        all_ok=false
    fi
    
    # 检查 Eisvogel 模板
    local template_paths=(
        "$HOME/.local/share/pandoc/templates/eisvogel.latex"
        "$HOME/.pandoc/templates/eisvogel.latex"
        "/usr/share/pandoc/data/templates/eisvogel.latex"
    )
    local eisvogel_found=false
    for path in "${template_paths[@]}"; do
        if [ -f "$path" ]; then
            eisvogel_found=true
            echo "[OK] Eisvogel 模板已安装: $path"
            break
        fi
    done
    if [ "$eisvogel_found" = false ]; then
        echo "[错误] Eisvogel 模板未安装"
        echo "  安装步骤:"
        echo "  mkdir -p ~/.local/share/pandoc/templates"
        echo "  wget -O ~/.local/share/pandoc/templates/eisvogel.latex \\"
        echo "    https://raw.githubusercontent.com/Wandmalfarbe/pandoc-latex-template/master/eisvogel.latex"
        all_ok=false
    fi
    
    # 检查中文字体
    if command -v fc-list &> /dev/null; then
        if fc-list :lang=zh 2>/dev/null | grep -q .; then
            echo "[OK] 中文字体已安装"
        else
            echo "[警告] 未检测到中文字体，PDF 中文可能显示异常"
            echo "  推荐安装: sudo apt install fonts-noto-cjk (Ubuntu)"
        fi
    fi
    
    if [ "$all_ok" = true ]; then
        return 0
    else
        return 1
    fi
}

# ==========================================
# 主逻辑
# ==========================================

# 处理特殊命令
if [ "$SHOW_HELP" = true ]; then
    show_help
    exit 0
fi

if [ "$LIST_CLIENTS" = true ]; then
    list_clients
    exit 0
fi

if [ "$LIST_DOCS" = true ]; then
    list_docs
    exit 0
fi

if [ "$CHECK_PDF_DEPS" = true ]; then
    check_pdf_dependencies
    exit 0
fi

# 设置路径
CLIENT_DIR="${CLIENTS_DIR}/${CLIENT}"
CLIENT_META="${CLIENT_DIR}/metadata.yaml"

# 确定配置文件（必须指定文档类型）
if [ -n "$DOC_TYPE" ]; then
    CONFIG_FILE="${CLIENT_DIR}/${DOC_TYPE}.yaml"
else
    # 没有指定文档类型时，尝试查找第一个可用的配置文件
    first_config=$(find "$CLIENT_DIR" -maxdepth 1 -name "*.yaml" ! -name "metadata.yaml" -type f 2>/dev/null | head -1)
    if [ -n "$first_config" ]; then
        CONFIG_FILE="$first_config"
        DOC_TYPE=$(basename "$first_config" .yaml)
        echo "[提示] 未指定文档类型，使用: $DOC_TYPE"
    else
        echo "[错误] 未指定文档类型，且客户目录中没有可用的配置文件"
        echo "用法: ./build.sh -c $CLIENT -d <文档类型>"
        list_docs
        exit 1
    fi
fi

echo "=========================================="
echo "构建文档 - 客户: ${CLIENT} [${DOC_TYPE}] [${FORMAT^^}]"
echo "=========================================="

# PDF 格式需要额外检查依赖
if [ "$FORMAT" = "pdf" ]; then
    if ! check_pdf_dependencies; then
        echo ""
        echo "[错误] PDF 依赖检查失败，请先安装所需依赖"
        exit 1
    fi
    echo "PDF 依赖检查通过"
    echo ""
fi

# 检查客户目录
if [ ! -d "$CLIENT_DIR" ]; then
    echo "[错误] 客户目录不存在: $CLIENT_DIR"
    echo ""
    list_clients
    exit 1
fi

# 检查配置文件
if [ ! -f "$CONFIG_FILE" ]; then
    echo "[错误] 配置文件不存在: $CONFIG_FILE"
    if [ -n "$DOC_TYPE" ]; then
        list_docs
    fi
    exit 1
fi

# 创建构建目录
mkdir -p "$BUILD_DIR"

# 读取配置
client_name=$(read_yaml_value "$CONFIG_FILE" "client_name")
template=$(read_yaml_value "$CONFIG_FILE" "template")
output_pattern=$(read_yaml_value "$CONFIG_FILE" "output_pattern")

# 读取模块列表
modules=()
while IFS= read -r line; do
    [ -n "$line" ] && modules+=("$line")
done < <(read_yaml_list "$CONFIG_FILE" "modules")

# 读取 Pandoc 参数
pandoc_args=()
while IFS= read -r line; do
    [ -n "$line" ] && pandoc_args+=("$line")
done < <(read_yaml_list "$CONFIG_FILE" "pandoc_args")

# 读取 PDF 选项
pdf_titlepage=$(read_pdf_option "$CONFIG_FILE" "titlepage" "true")
pdf_titlepage_color=$(read_pdf_option "$CONFIG_FILE" "titlepage_color" "2C3E50")
pdf_titlepage_text_color=$(read_pdf_option "$CONFIG_FILE" "titlepage_text_color" "FFFFFF")
pdf_CJKmainfont=$(read_pdf_option "$CONFIG_FILE" "CJKmainfont" "Noto Sans CJK SC")
pdf_mainfont=$(read_pdf_option "$CONFIG_FILE" "mainfont" "Noto Sans")
pdf_monofont=$(read_pdf_option "$CONFIG_FILE" "monofont" "Noto Sans Mono")
pdf_toc=$(read_pdf_option "$CONFIG_FILE" "toc" "true")
pdf_toc_depth=$(read_pdf_option "$CONFIG_FILE" "toc_depth" "3")

# 默认值
[ -z "$client_name" ] && client_name="$CLIENT"
[ -z "$template" ] && template="default.docx"
[ -z "$output_pattern" ] && output_pattern="{title}_{date}.docx"

# 如果传入了自定义客户名称，使用它覆盖配置
if [ -n "$CUSTOM_CLIENT_NAME" ]; then
    client_name="$CUSTOM_CLIENT_NAME"
    echo "使用自定义客户名称: $CUSTOM_CLIENT_NAME"
fi

echo "客户名称: $client_name"
echo "输出格式: $FORMAT"
echo "模块: ${modules[*]}"

# 检查模块文件
valid_modules=()
for module in "${modules[@]}"; do
    if [ -f "$module" ]; then
        valid_modules+=("$module")
    else
        echo "[警告] 模块不存在: $module"
    fi
done

if [ ${#valid_modules[@]} -eq 0 ]; then
    echo "[错误] 没有有效的文档模块！"
    exit 1
fi

# 读取元数据
title=$(read_yaml_value "${SRC_DIR}/metadata.yaml" "title")
version=$(read_yaml_value "${SRC_DIR}/metadata.yaml" "version")
date=$(date +%Y-%m-%d)

# 客户元数据覆盖
if [ -f "$CLIENT_META" ]; then
    client_title=$(read_yaml_value "$CLIENT_META" "title")
    client_version=$(read_yaml_value "$CLIENT_META" "version")
    [ -n "$client_title" ] && title="$client_title"
    [ -n "$client_version" ] && version="$client_version"
fi

[ -z "$title" ] && title="Document"
[ -z "$version" ] && version="v1.0"

# 清理文件名
client_name_clean=$(echo "$client_name" | tr ' ' '_')
title_clean=$(echo "$title" | tr ' ' '_')

# 调整输出扩展名
if [ "$FORMAT" = "pdf" ]; then
    output_pattern_adjusted=$(echo "$output_pattern" | sed 's/\.docx$/.pdf/')
else
    output_pattern_adjusted="$output_pattern"
fi

# 生成输出文件名
output_filename=$(replace_placeholders "$output_pattern_adjusted" "$client_name_clean" "$title_clean" "$version" "$date")
output_path="${BUILD_DIR}/${output_filename}"

echo "输出: $output_path"
echo ""

# 构建 Pandoc 命令
pandoc_cmd=(pandoc)
pandoc_cmd+=("${valid_modules[@]}")

if [ -f "$CLIENT_META" ]; then
    pandoc_cmd+=("$CLIENT_META")
fi

pandoc_cmd+=(-o "$output_path")

if [ "$FORMAT" = "word" ]; then
    template_path="${TEMPLATES_DIR}/${template}"
    if [ -f "$template_path" ]; then
        pandoc_cmd+=(--reference-doc="$template_path")
    fi
else
    pandoc_cmd+=(--pdf-engine=xelatex)
    pandoc_cmd+=(--template=eisvogel)
    [ "$pdf_titlepage" = "true" ] && pandoc_cmd+=(-V titlepage=true)
    [ -n "$pdf_titlepage_color" ] && pandoc_cmd+=(-V "titlepage-color=$pdf_titlepage_color")
    [ -n "$pdf_CJKmainfont" ] && pandoc_cmd+=(-V "CJKmainfont=$pdf_CJKmainfont")
    [ -n "$pdf_mainfont" ] && pandoc_cmd+=(-V "mainfont=$pdf_mainfont")
    [ "$pdf_toc" = "true" ] && pandoc_cmd+=(--toc --toc-depth="$pdf_toc_depth")
fi

pandoc_cmd+=(--resource-path="$SRC_DIR")
pandoc_cmd+=("${pandoc_args[@]}")

echo "执行: ${pandoc_cmd[*]}"
echo ""

# 执行
if "${pandoc_cmd[@]}"; then
    echo "=========================================="
    echo "构建成功！"
    echo "输出文件: $output_path"
    echo "=========================================="
else
    echo "[错误] Pandoc 执行失败！"
    exit 1
fi
