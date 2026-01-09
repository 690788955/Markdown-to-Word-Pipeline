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
declare -A VAR_VALUES  # 变量值关联数组

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
        -V|--var)
            # 解析 name=value 格式
            if [[ "$2" =~ ^([^=]+)=(.*)$ ]]; then
                VAR_VALUES["${BASH_REMATCH[1]}"]="${BASH_REMATCH[2]}"
            fi
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
  -V, --var <name=value> 设置变量值，可多次使用
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
  ./build.sh -V "项目名称=XX系统" -V "版本号=v2.0"  # 设置变量
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
# 变量处理函数
# ==========================================

# 从文件提取变量声明
get_variables_from_file() {
    local file="$1"
    
    if [ ! -f "$file" ]; then
        return
    fi
    
    # 检查是否有 front-matter
    if ! head -1 "$file" | grep -q "^---"; then
        return
    fi
    
    # 使用 awk 提取 variables 节中的变量名和默认值
    awk '
        BEGIN { in_fm=0; in_vars=0; current_var="" }
        /^---$/ && NR==1 { in_fm=1; next }
        /^---$/ && in_fm { exit }
        in_fm && /^variables:/ { in_vars=1; next }
        in_vars && /^[a-zA-Z]/ { exit }
        in_vars && /^  [a-zA-Z_][a-zA-Z0-9_.]*:/ {
            gsub(/^  /, "")
            gsub(/:.*/, "")
            current_var=$0
            print current_var
        }
    ' "$file"
}

# 获取变量默认值
get_variable_default() {
    local file="$1"
    local var_name="$2"
    
    if [ ! -f "$file" ]; then
        return
    fi
    
    awk -v var="$var_name" '
        BEGIN { in_fm=0; in_vars=0; found_var=0 }
        /^---$/ && NR==1 { in_fm=1; next }
        /^---$/ && in_fm { exit }
        in_fm && /^variables:/ { in_vars=1; next }
        in_vars && /^[a-zA-Z]/ { exit }
        in_vars && $0 ~ "^  "var":" {
            # 检查是否是简单值
            line=$0
            gsub(/^  [^:]+:[[:space:]]*/, "", line)
            gsub(/["'"'"']/, "", line)
            if (line != "") {
                print line
                exit
            }
            found_var=1
            next
        }
        found_var && /^    default:/ {
            line=$0
            gsub(/^    default:[[:space:]]*/, "", line)
            gsub(/["'"'"']/, "", line)
            print line
            exit
        }
        found_var && /^  [a-zA-Z]/ { exit }
    ' "$file"
}

# 渲染文件内容（替换变量）
render_file_content() {
    local file="$1"
    local output="$2"
    
    local content
    content=$(cat "$file")
    
    # 获取文件中的变量
    local vars
    vars=$(get_variables_from_file "$file")
    
    if [ -z "$vars" ]; then
        # 没有变量，直接复制
        cp "$file" "$output"
        return
    fi
    
    # 替换变量
    for var in $vars; do
        local value=""
        
        # 优先使用命令行传入的值
        if [ -n "${VAR_VALUES[$var]+x}" ]; then
            value="${VAR_VALUES[$var]}"
        else
            # 使用默认值
            value=$(get_variable_default "$file" "$var")
        fi
        
        if [ -n "$value" ]; then
            # 替换 {{var}} 为值
            content=$(echo "$content" | sed "s/{{${var}}}/${value}/g")
        fi
    done
    
    # 处理转义的占位符 \{{text}} -> {{text}}
    content=$(echo "$content" | sed 's/\\{{/{{/g')
    
    # 移除 variables 节（简化处理）
    content=$(echo "$content" | awk '
        BEGIN { in_fm=0; in_vars=0; skip_vars=0 }
        /^---$/ && NR==1 { in_fm=1; print; next }
        /^---$/ && in_fm { in_fm=0; print; next }
        in_fm && /^variables:/ { skip_vars=1; next }
        skip_vars && /^[a-zA-Z]/ { skip_vars=0 }
        skip_vars { next }
        { print }
    ')
    
    echo "$content" > "$output"
}

# 处理模块文件的变量渲染
process_modules_with_variables() {
    local temp_dir="$1"
    shift
    local modules=("$@")
    
    local processed_modules=()
    local has_variables=false
    
    # 检查是否有变量
    for module in "${modules[@]}"; do
        local vars
        vars=$(get_variables_from_file "$module")
        if [ -n "$vars" ]; then
            has_variables=true
            break
        fi
    done
    
    if [ "$has_variables" = false ] && [ ${#VAR_VALUES[@]} -eq 0 ]; then
        # 没有变量，返回原模块列表
        echo "${modules[@]}"
        return
    fi
    
    echo "处理变量模板..." >&2
    
    # 创建临时目录
    mkdir -p "$temp_dir"
    
    for module in "${modules[@]}"; do
        local vars
        vars=$(get_variables_from_file "$module")
        
        if [ -n "$vars" ]; then
            local basename
            basename=$(basename "$module")
            local temp_file="${temp_dir}/${basename}"
            render_file_content "$module" "$temp_file"
            processed_modules+=("$temp_file")
        else
            processed_modules+=("$module")
        fi
    done
    
    echo "${processed_modules[@]}"
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
        BEGIN { in_list=0 }
        $0 ~ "^"key":" { in_list=1; next }
        in_list && /^[[:space:]]*$/ { next }  # 跳过空行
        in_list && /^[[:space:]]*#/ { next }  # 跳过注释行
        in_list && /^[[:space:]]+-/ { 
            line = $0
            gsub(/^[[:space:]]+-[[:space:]]*/, "", line)
            gsub(/["'"'"']/, "", line)
            gsub(/[[:space:]]*$/, "", line)
            if (line != "") print line
            next
        }
        in_list && /^[^[:space:]-]/ { exit }  # 遇到新的顶级键退出
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
    
    # 支持带连字符和下划线的键名
    local key_pattern="$key"
    local key_alt="${key//-/_}"  # 将连字符替换为下划线
    
    local value
    value=$(awk -v key="$key" -v key_alt="$key_alt" '
        /^pdf_options:/ { in_section=1; next }
        in_section && /^[^[:space:]]/ { exit }
        in_section && ($0 ~ "^[[:space:]]+"key":" || $0 ~ "^[[:space:]]+"key_alt":") {
            sub(/^[[:space:]]+[^:]+:[[:space:]]*/, "")
            gsub(/["'\'']/, "")
            # 去除行尾注释（# 开头的部分）
            sub(/[[:space:]]*#.*$/, "")
            gsub(/[[:space:]]*$/, "")
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

# 展开通配符模式（如 src/*.md）
expanded_modules=()
for module in "${modules[@]}"; do
    if [[ "$module" == *"*"* ]]; then
        # 包含通配符，展开它
        # shellcheck disable=SC2086
        for expanded in $module; do
            if [ -f "$expanded" ]; then
                expanded_modules+=("$expanded")
            fi
        done
    else
        expanded_modules+=("$module")
    fi
done
modules=("${expanded_modules[@]}")

# 注意：保持配置文件中指定的模块顺序，不进行排序
# 如果需要按文件名排序，可以取消下面的注释
# IFS=$'\n' sorted_modules=($(sort <<<"${modules[*]}")); unset IFS
# modules=("${sorted_modules[@]}")

# 读取 Pandoc 参数
pandoc_args=()
while IFS= read -r line; do
    [ -n "$line" ] && pandoc_args+=("$line")
done < <(read_yaml_list "$CONFIG_FILE" "pandoc_args")

# 读取 PDF 选项（使用更通用的默认字体）
pdf_titlepage=$(read_pdf_option "$CONFIG_FILE" "titlepage" "true")
pdf_titlepage_color=$(read_pdf_option "$CONFIG_FILE" "titlepage-color" "2C3E50")
pdf_titlepage_text_color=$(read_pdf_option "$CONFIG_FILE" "titlepage-text-color" "FFFFFF")
# 字体默认值：Linux 优先使用 Noto Sans CJK SC，macOS 使用 PingFang SC
if [[ "$OSTYPE" == "darwin"* ]]; then
    default_cjk_font="PingFang SC"
    default_mono_font="Menlo"
else
    default_cjk_font="Noto Sans CJK SC"
    # DejaVu Sans Mono 在大多数 Linux 发行版上预装（包括 Alpine）
    default_mono_font="DejaVu Sans Mono"
fi
pdf_CJKmainfont=$(read_pdf_option "$CONFIG_FILE" "CJKmainfont" "$default_cjk_font")
pdf_mainfont=$(read_pdf_option "$CONFIG_FILE" "mainfont" "$default_cjk_font")
pdf_monofont=$(read_pdf_option "$CONFIG_FILE" "monofont" "$default_mono_font")
pdf_toc=$(read_pdf_option "$CONFIG_FILE" "toc" "true")
pdf_toc_depth=$(read_pdf_option "$CONFIG_FILE" "toc-depth" "3")

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

# 处理变量模板
TEMP_DIR="/tmp/docgen_$$"
processed_modules_str=$(process_modules_with_variables "$TEMP_DIR" "${valid_modules[@]}")
read -ra processed_modules <<< "$processed_modules_str"

# 读取元数据（优先级：文档配置 > 客户 metadata.yaml > src/metadata.yaml）
# 1. 基础元数据
title=$(read_yaml_value "${SRC_DIR}/metadata.yaml" "title")
version=$(read_yaml_value "${SRC_DIR}/metadata.yaml" "version")
subtitle=$(read_yaml_value "${SRC_DIR}/metadata.yaml" "subtitle")
author=$(read_yaml_value "${SRC_DIR}/metadata.yaml" "author")
date=$(date +%Y-%m-%d)

# 2. 客户元数据覆盖
if [ -f "$CLIENT_META" ]; then
    client_title=$(read_yaml_value "$CLIENT_META" "title")
    client_version=$(read_yaml_value "$CLIENT_META" "version")
    client_subtitle=$(read_yaml_value "$CLIENT_META" "subtitle")
    client_author=$(read_yaml_value "$CLIENT_META" "author")
    client_date=$(read_yaml_value "$CLIENT_META" "date")
    [ -n "$client_title" ] && title="$client_title"
    [ -n "$client_version" ] && version="$client_version"
    [ -n "$client_subtitle" ] && subtitle="$client_subtitle"
    [ -n "$client_author" ] && author="$client_author"
    [ -n "$client_date" ] && date="$client_date"
fi

# 3. 文档配置覆盖（最高优先级）
doc_title=$(read_yaml_value "$CONFIG_FILE" "title")
doc_version=$(read_yaml_value "$CONFIG_FILE" "version")
doc_subtitle=$(read_yaml_value "$CONFIG_FILE" "subtitle")
doc_author=$(read_yaml_value "$CONFIG_FILE" "author")
doc_date=$(read_yaml_value "$CONFIG_FILE" "date")
[ -n "$doc_title" ] && title="$doc_title"
[ -n "$doc_version" ] && version="$doc_version"
[ -n "$doc_subtitle" ] && subtitle="$doc_subtitle"
[ -n "$doc_author" ] && author="$doc_author"
[ -n "$doc_date" ] && date="$doc_date"

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
pandoc_cmd+=("${processed_modules[@]}")

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
    # 表格兼容性设置 - 使用简单表格格式避免 longtable 兼容性问题
    pandoc_cmd+=(--from=markdown-implicit_figures)
    pandoc_cmd+=(-V table-use-row-colors=true)
    [ "$pdf_titlepage" = "true" ] && pandoc_cmd+=(-V titlepage=true)
    [ -n "$pdf_titlepage_color" ] && pandoc_cmd+=(-V "titlepage-color=$pdf_titlepage_color")
    [ -n "$pdf_CJKmainfont" ] && pandoc_cmd+=(-V "CJKmainfont=$pdf_CJKmainfont")
    [ -n "$pdf_mainfont" ] && pandoc_cmd+=(-V "mainfont=$pdf_mainfont")
    [ -n "$pdf_monofont" ] && pandoc_cmd+=(-V "monofont=$pdf_monofont")
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
