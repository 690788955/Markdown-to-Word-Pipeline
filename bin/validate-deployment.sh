#!/bin/bash
# ==========================================
# Docker Compose 部署验证脚本
# ==========================================
#
# 用途: 验证 docker-compose 配置和环境变量设置
# 使用: ./validate-deployment.sh [--check-only] [--verbose]

set -e

# 参数解析
CHECK_ONLY=false
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --check-only)
            CHECK_ONLY=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        *)
            echo "未知参数: $1"
            echo "使用方法: $0 [--check-only] [--verbose]"
            exit 1
            ;;
    esac
done

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

ERROR_COUNT=0

# 函数：记录错误
log_error() {
    echo -e "${RED}✗ $1${NC}"
    ((ERROR_COUNT++))
}

# 函数：记录成功
log_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# 函数：记录警告
log_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# 函数：记录信息
log_info() {
    if [ "$VERBOSE" = true ]; then
        echo -e "${BLUE}ℹ $1${NC}"
    fi
}

echo -e "${CYAN}===========================================${NC}"
echo -e "${CYAN}Docker Compose 部署验证${NC}"
echo -e "${CYAN}===========================================${NC}"

# 1. 检查 Docker 环境
echo -e "\n${YELLOW}1. 检查 Docker 环境...${NC}"

if command -v docker &> /dev/null; then
    docker_version=$(docker --version)
    log_success "Docker 可用: $docker_version"
else
    log_error "Docker 未安装或不可用"
fi

if docker compose version &> /dev/null; then
    compose_version=$(docker compose version)
    log_success "Docker Compose 可用: $compose_version"
else
    log_error "Docker Compose 未安装或不可用"
fi

# 2. 验证环境变量
echo -e "\n${YELLOW}2. 验证环境变量...${NC}"

# 检查端口
if [ -n "$PORT" ]; then
    if [[ "$PORT" =~ ^[0-9]+$ ]] && [ "$PORT" -ge 1024 ] && [ "$PORT" -le 65535 ]; then
        log_success "端口 $PORT 在有效范围内 (1024-65535)"
        
        # 检查端口是否被占用
        if command -v netstat &> /dev/null; then
            if netstat -tuln | grep -q ":$PORT "; then
                log_warning "端口 $PORT 可能已被占用"
            else
                log_success "端口 $PORT 可用"
            fi
        elif command -v ss &> /dev/null; then
            if ss -tuln | grep -q ":$PORT "; then
                log_warning "端口 $PORT 可能已被占用"
            else
                log_success "端口 $PORT 可用"
            fi
        else
            log_warning "无法检查端口 $PORT 可用性（缺少 netstat 或 ss 命令）"
        fi
    else
        log_error "端口 $PORT 无效或超出范围 (1024-65535)"
    fi
else
    log_info "使用默认端口 8080"
fi

# 检查目录变量
declare -A directories=(
    ["DOCS_DIR"]="$DOCS_DIR"
    ["SRC_DIR"]="$SRC_DIR"
    ["CLIENTS_DIR"]="$CLIENTS_DIR"
    ["TEMPLATES_DIR"]="$TEMPLATES_DIR"
    ["OUTPUT_DIR"]="$OUTPUT_DIR"
)

for dir_var in "${!directories[@]}"; do
    dir_path="${directories[$dir_var]}"
    if [ -n "$dir_path" ]; then
        log_info "检查 $dir_var: $dir_path"
        
        if [ -d "$dir_path" ]; then
            log_success "$dir_var 目录存在: $dir_path"
            
            # 检查读写权限
            if [ -r "$dir_path" ] && [ -w "$dir_path" ]; then
                log_success "$dir_var 目录可读写"
            else
                log_warning "$dir_var 目录权限可能不足"
            fi
        else
            if [ "$dir_var" = "OUTPUT_DIR" ]; then
                log_warning "$dir_var 目录不存在，将自动创建: $dir_path"
            else
                log_error "$dir_var 目录不存在: $dir_path"
            fi
        fi
    fi
done

# 3. 验证 docker-compose.yml 配置
echo -e "\n${YELLOW}3. 验证 docker-compose.yml 配置...${NC}"

if [ -f "docker-compose.yml" ]; then
    log_success "docker-compose.yml 文件存在"
    
    if config=$(docker compose config 2>&1); then
        log_success "docker-compose.yml 语法正确"
        
        if [ "$VERBOSE" = true ]; then
            echo -e "\n${BLUE}生成的配置:${NC}"
            echo -e "${NC}$config${NC}"
        fi
    else
        log_error "docker-compose.yml 配置错误: $config"
    fi
else
    log_error "docker-compose.yml 文件不存在"
fi

# 4. 检查必需的目录结构
echo -e "\n${YELLOW}4. 检查项目目录结构...${NC}"

required_dirs=("src" "clients" "templates")

# 如果没有设置 DOCS_DIR，检查默认目录
if [ -z "$DOCS_DIR" ]; then
    for dir in "${required_dirs[@]}"; do
        if [ -d "$dir" ]; then
            log_success "找到默认 $dir 目录"
        else
            log_warning "默认 $dir 目录不存在，可能需要创建"
        fi
    done
else
    # 如果设置了 DOCS_DIR，检查其子目录
    for dir in "${required_dirs[@]}"; do
        full_path="$DOCS_DIR/$dir"
        if [ -d "$full_path" ]; then
            log_success "找到 $dir 目录: $full_path"
        else
            log_warning "$dir 目录不存在: $full_path"
        fi
    done
fi

# 检查输出目录
output_dir="${OUTPUT_DIR:-./build}"
if [ -d "$output_dir" ]; then
    log_success "输出目录存在: $output_dir"
else
    log_info "输出目录将自动创建: $output_dir"
fi

# 5. 检查 Dockerfile
echo -e "\n${YELLOW}5. 检查 Dockerfile...${NC}"
if [ -f "web/Dockerfile" ]; then
    log_success "Dockerfile 存在: web/Dockerfile"
else
    log_warning "Dockerfile 不存在: web/Dockerfile（如果使用自定义镜像则无需关心）"
fi

# 6. 网络连通性检查（如果不是仅检查模式）
if [ "$CHECK_ONLY" = false ]; then
    echo -e "\n${YELLOW}6. 网络连通性检查...${NC}"
    
    test_port="${PORT:-8080}"
    
    # 尝试绑定端口测试
    if command -v nc &> /dev/null; then
        if ! nc -z localhost "$test_port" 2>/dev/null; then
            log_success "端口 $test_port 可用"
        else
            log_warning "端口 $test_port 可能已被占用"
        fi
    else
        log_info "跳过端口测试（缺少 nc 命令）"
    fi
fi

# 7. 总结
echo -e "\n${CYAN}===========================================${NC}"
if [ $ERROR_COUNT -eq 0 ]; then
    echo -e "${GREEN}✓ 所有检查通过，可以部署${NC}"
    exit_code=0
else
    echo -e "${RED}✗ 发现 $ERROR_COUNT 个错误，请修复后重试${NC}"
    exit_code=1
fi
echo -e "${CYAN}===========================================${NC}"

# 8. 部署建议
echo -e "\n${YELLOW}部署建议:${NC}"
echo -e "${NC}1. 运行验证: ./validate-deployment.sh --verbose${NC}"
echo -e "${NC}2. 检查配置: docker compose config${NC}"
echo -e "${NC}3. 启动服务: docker compose up -d${NC}"
echo -e "${NC}4. 检查状态: docker compose ps${NC}"
echo -e "${NC}5. 查看日志: docker compose logs -f${NC}"

access_url="http://localhost:${PORT:-8080}"
echo -e "${NC}6. 访问服务: $access_url${NC}"

exit $exit_code