#!/bin/bash
# ==========================================
# 运维文档生成系统 - 构建脚本
# ==========================================

set -e

# 参数
CLIENT="${1:-default}"
DOC_TYPE="${2:-}"
CUSTOM_CLIENT_NAME="${3:-}"

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
# 主逻辑
# ==========================================

echo "=========================================="
if [ -n "$DOC_TYPE" ]; then
    echo "构建文档 - 客户: ${CLIENT} [${DOC_TYPE}]"
else
    echo "构建文档 - 客户: ${CLIENT}"
fi
echo "=========================================="

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
echo "模板: $template"
echo "模块: ${modules[*]}"

# 检查模板文件
template_path="${TEMPLATES_DIR}/${template}"
if [ ! -f "$template_path" ]; then
    echo "[警告] 模板不存在: $template_path"
    echo "运行 'make init-template' 生成默认模板"
    echo "继续构建（不使用模板）..."
    template_path=""
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

# 生成输出文件名
output_filename=$(replace_placeholders "$output_pattern" "$client_name_clean" "$title_clean" "$version" "$date")
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

# 添加模板
if [ -n "$template_path" ]; then
    pandoc_cmd+=(--reference-doc="$template_path")
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
