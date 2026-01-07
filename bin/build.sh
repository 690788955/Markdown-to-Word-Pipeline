#!/bin/bash
# ==========================================
# 运维文档生成系统 - 构建脚本
# 支持 Word 和 PDF 格式输出
# ==========================================

set -e

# 参数
CLIENT="${1:-default}"
DOC_TYPE="${2:-}"
CUSTOM_CLIENT_NAME="${3:-}"
FORMAT="${4:-word}"  # 输出格式：word 或 pdf

# 配置
SRC_DIR="src"
CLIENTS_DIR="clients"
TEMPLATES_DIR="templates"
BUILD_DIR="build"

CLIENT_DIR="${CLIENTS_DIR}/${CLIENT}"
CLIENT_META="${CLIENT_DIR}/metadata.yaml"

# 确定配置文件
if [ -n "$DOC_TYPE" ]; then
    CONFIG_FILE="${CLIENT_DIR}/${DOC_TYPE}.yaml"
else
    CONFIG_FILE="${CLIENT_DIR}/config.yaml"
fi

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
        in_list && /^[[:space:]]+-/ { 
            gsub(/^[[:space:]]+-[[:space:]]*/, "")
            gsub(/["'\'']/, "")
            print
        }
        in_list && /^[^[:space:]]/ && !/^[[:space:]]*#/ { exit }
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

echo "=========================================="
if [ -n "$DOC_TYPE" ]; then
    echo "构建文档 - 客户: ${CLIENT} [${DOC_TYPE}] [${FORMAT^^}]"
else
    echo "构建文档 - 客户: ${CLIENT} [${FORMAT^^}]"
fi
echo "=========================================="

# PDF 格式需要额外检查依赖
if [ "$FORMAT" = "pdf" ]; then
    echo "检查 PDF 生成依赖..."
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
    echo "可用客户:"
    for dir in ${CLIENTS_DIR}/*/; do
        echo "  - $(basename "$dir")"
    done
    exit 1
fi

# 检查配置文件
if [ ! -f "$CONFIG_FILE" ]; then
    echo "[错误] 配置文件不存在: $CONFIG_FILE"
    if [ -n "$DOC_TYPE" ]; then
        echo "可用的文档类型:"
        for f in ${CLIENT_DIR}/*.yaml; do
            name=$(basename "$f" .yaml)
            [ "$name" = "metadata" ] && continue
            [ "$name" = "config" ] && echo "  - (默认)" || echo "  - $name"
        done
    fi
    exit 1
fi

# 验证 YAML 格式（基础检查）
if ! grep -q "^modules:" "$CONFIG_FILE" 2>/dev/null; then
    echo "[警告] 配置中未找到 'modules' 键，使用默认值"
fi

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

# 读取 PDF 选项（从配置文件，使用默认值）
pdf_titlepage=$(read_pdf_option "$CONFIG_FILE" "titlepage" "true")
pdf_titlepage_color=$(read_pdf_option "$CONFIG_FILE" "titlepage_color" "2C3E50")
pdf_titlepage_text_color=$(read_pdf_option "$CONFIG_FILE" "titlepage_text_color" "FFFFFF")
pdf_titlepage_rule_color=$(read_pdf_option "$CONFIG_FILE" "titlepage_rule_color" "3498DB")
pdf_logo=$(read_pdf_option "$CONFIG_FILE" "logo" "")
pdf_logo_width=$(read_pdf_option "$CONFIG_FILE" "logo_width" "100")
pdf_listings=$(read_pdf_option "$CONFIG_FILE" "listings" "true")
pdf_CJKmainfont=$(read_pdf_option "$CONFIG_FILE" "CJKmainfont" "Noto Sans CJK SC")
pdf_mainfont=$(read_pdf_option "$CONFIG_FILE" "mainfont" "Noto Sans")
pdf_monofont=$(read_pdf_option "$CONFIG_FILE" "monofont" "Noto Sans Mono")
pdf_toc=$(read_pdf_option "$CONFIG_FILE" "toc" "true")
pdf_toc_depth=$(read_pdf_option "$CONFIG_FILE" "toc_depth" "3")
pdf_number_sections=$(read_pdf_option "$CONFIG_FILE" "number_sections" "true")
pdf_colorlinks=$(read_pdf_option "$CONFIG_FILE" "colorlinks" "true")
pdf_linkcolor=$(read_pdf_option "$CONFIG_FILE" "linkcolor" "blue")

# 从 metadata.yaml 覆盖 PDF 选项
if [ -f "$CLIENT_META" ]; then
    meta_titlepage=$(read_pdf_option "$CLIENT_META" "titlepage" "")
    [ -n "$meta_titlepage" ] && pdf_titlepage="$meta_titlepage"
    meta_titlepage_color=$(read_pdf_option "$CLIENT_META" "titlepage_color" "")
    [ -n "$meta_titlepage_color" ] && pdf_titlepage_color="$meta_titlepage_color"
    meta_CJKmainfont=$(read_pdf_option "$CLIENT_META" "CJKmainfont" "")
    [ -n "$meta_CJKmainfont" ] && pdf_CJKmainfont="$meta_CJKmainfont"
fi

# 默认值
[ -z "$client_name" ] && client_name="$CLIENT"
[ -z "$template" ] && template="default.docx"
[ -z "$output_pattern" ] && output_pattern="{title}_{date}.docx"
[ ${#modules[@]} -eq 0 ] && modules=("${SRC_DIR}/metadata.yaml" "${SRC_DIR}/01-overview.md")

# 如果传入了自定义客户名称，使用它覆盖配置
if [ -n "$CUSTOM_CLIENT_NAME" ]; then
    client_name="$CUSTOM_CLIENT_NAME"
    echo "使用自定义客户名称: $CUSTOM_CLIENT_NAME"
fi

echo "客户名称: $client_name"
echo "输出格式: $FORMAT"
if [ "$FORMAT" = "word" ]; then
    echo "模板: $template"
fi
echo "模块: ${modules[*]}"

# 检查模板文件（仅 Word 格式需要）
template_path=""
if [ "$FORMAT" = "word" ]; then
    template_path="${TEMPLATES_DIR}/${template}"
    if [ ! -f "$template_path" ]; then
        echo "[警告] 模板不存在: $template_path"
        echo "运行 'make init-template' 生成默认模板"
        echo "继续构建（不使用模板）..."
        template_path=""
    fi
fi

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

# 检查图片引用
echo "检查图片引用..."
for module in "${valid_modules[@]}"; do
    if [[ "$module" == *.md ]]; then
        grep -oE '!\[[^]]*\]\([^)]+\)' "$module" 2>/dev/null | while read -r img_ref; do
            img_path=$(echo "$img_ref" | sed 's/.*](\([^)]*\)).*/\1/')
            full_path="${SRC_DIR}/${img_path}"
            if [[ ! "$img_path" =~ ^http ]] && [ ! -f "$full_path" ] && [ ! -f "$img_path" ]; then
                echo "[警告] 图片不存在: $img_path (在 $module 中)"
            fi
        done
    fi
done
echo ""

# 读取元数据用于文件名
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

# 默认值
[ -z "$title" ] && title="Document"
[ -z "$version" ] && version="v1.0"

# 清理文件名中的空格
client_name_clean=$(echo "$client_name" | tr ' ' '_')
title_clean=$(echo "$title" | tr ' ' '_')

# 根据格式调整输出文件扩展名
if [ "$FORMAT" = "pdf" ]; then
    output_pattern_adjusted=$(echo "$output_pattern" | sed 's/\.docx$/.pdf/')
    if [[ ! "$output_pattern_adjusted" =~ \.pdf$ ]]; then
        output_pattern_adjusted=$(echo "$output_pattern_adjusted" | sed 's/\.[^.]*$/.pdf/')
    fi
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

# 添加客户元数据文件
if [ -f "$CLIENT_META" ]; then
    pandoc_cmd+=("$CLIENT_META")
fi

pandoc_cmd+=(-o "$output_path")

if [ "$FORMAT" = "word" ]; then
    # Word 格式参数
    if [ -n "$template_path" ]; then
        pandoc_cmd+=(--reference-doc="$template_path")
    fi
else
    # PDF 格式参数
    pandoc_cmd+=(--pdf-engine=xelatex)
    pandoc_cmd+=(--template=eisvogel)
    
    # 应用 PDF 选项
    [ "$pdf_titlepage" = "true" ] && pandoc_cmd+=(-V titlepage=true)
    [ -n "$pdf_titlepage_color" ] && pandoc_cmd+=(-V "titlepage-color=$pdf_titlepage_color")
    [ -n "$pdf_titlepage_text_color" ] && pandoc_cmd+=(-V "titlepage-text-color=$pdf_titlepage_text_color")
    [ -n "$pdf_titlepage_rule_color" ] && pandoc_cmd+=(-V "titlepage-rule-color=$pdf_titlepage_rule_color")
    
    if [ -n "$pdf_logo" ] && [ -f "${SRC_DIR}/${pdf_logo}" ]; then
        pandoc_cmd+=(-V "logo=$pdf_logo")
        pandoc_cmd+=(-V "logo-width=$pdf_logo_width")
    fi
    
    [ "$pdf_listings" = "true" ] && pandoc_cmd+=(-V listings=true)
    [ -n "$pdf_CJKmainfont" ] && pandoc_cmd+=(-V "CJKmainfont=$pdf_CJKmainfont")
    [ -n "$pdf_mainfont" ] && pandoc_cmd+=(-V "mainfont=$pdf_mainfont")
    [ -n "$pdf_monofont" ] && pandoc_cmd+=(-V "monofont=$pdf_monofont")
    
    if [ "$pdf_toc" = "true" ]; then
        pandoc_cmd+=(--toc)
        pandoc_cmd+=(--toc-depth="$pdf_toc_depth")
    fi
    
    [ "$pdf_number_sections" = "true" ] && pandoc_cmd+=(--number-sections)
    
    if [ "$pdf_colorlinks" = "true" ]; then
        pandoc_cmd+=(-V colorlinks=true)
        pandoc_cmd+=(-V "linkcolor=$pdf_linkcolor")
    fi
fi

# 添加资源路径
pandoc_cmd+=(--resource-path="$SRC_DIR")

# 添加额外参数
for arg in "${pandoc_args[@]}"; do
    pandoc_cmd+=("$arg")
done

echo "执行: ${pandoc_cmd[*]}"
echo ""

# 执行 Pandoc
if "${pandoc_cmd[@]}"; then
    echo "=========================================="
    echo "构建成功！"
    echo "输出文件: $output_path"
    echo "=========================================="
else
    echo "[错误] Pandoc 执行失败！"
    exit 1
fi
