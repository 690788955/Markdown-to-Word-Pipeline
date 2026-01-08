#!/bin/bash
# ==========================================
# Docker Compose 向后兼容性验证脚本
# ==========================================
#
# 用途: 验证增强的 docker-compose.yml 配置与原始版本的兼容性
# 使用: ./validate-compatibility.sh

set -e

echo "==========================================="
echo "Docker Compose 向后兼容性验证"
echo "==========================================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 检查 Docker 和 Docker Compose 是否可用
echo -e "\n${YELLOW}1. 检查 Docker 环境...${NC}"
if command -v docker &> /dev/null; then
    docker_version=$(docker --version)
    echo -e "${GREEN}✓ Docker: $docker_version${NC}"
else
    echo -e "${RED}✗ Docker 未安装或不可用${NC}"
    exit 1
fi

if docker compose version &> /dev/null; then
    compose_version=$(docker compose version)
    echo -e "${GREEN}✓ Docker Compose: $compose_version${NC}"
else
    echo -e "${RED}✗ Docker Compose 未安装或不可用${NC}"
    exit 1
fi

# 验证默认配置（无环境变量）
echo -e "\n${YELLOW}2. 验证默认配置（向后兼容性）...${NC}"

# 清除所有相关环境变量
unset PORT DOCS_DIR SRC_DIR CLIENTS_DIR TEMPLATES_DIR OUTPUT_DIR IMAGE

if config=$(docker compose config 2>&1); then
    echo -e "${GREEN}✓ 默认配置验证通过${NC}"
    
    # 检查默认端口
    if echo "$config" | grep -q '"8080:8080"'; then
        echo -e "${GREEN}✓ 默认端口 8080 配置正确${NC}"
    else
        echo -e "${RED}✗ 默认端口配置异常${NC}"
    fi
    
    # 检查默认卷挂载
    if echo "$config" | grep -q './src:/app/src' && \
       echo "$config" | grep -q './clients:/app/clients' && \
       echo "$config" | grep -q './templates:/app/templates' && \
       echo "$config" | grep -q './build:/app/build'; then
        echo -e "${GREEN}✓ 默认卷挂载配置正确${NC}"
    else
        echo -e "${RED}✗ 默认卷挂载配置异常${NC}"
    fi
else
    echo -e "${RED}✗ 默认配置验证失败: $config${NC}"
fi

# 验证 IMAGE 环境变量兼容性
echo -e "\n${YELLOW}3. 验证 IMAGE 环境变量兼容性...${NC}"
export IMAGE="custom-image:test"
if config=$(docker compose config 2>&1) && echo "$config" | grep -q 'custom-image:test'; then
    echo -e "${GREEN}✓ IMAGE 环境变量兼容性验证通过${NC}"
else
    echo -e "${RED}✗ IMAGE 环境变量不工作${NC}"
fi
unset IMAGE

# 验证端口配置
echo -e "\n${YELLOW}4. 验证端口配置...${NC}"
test_ports=(8080 9000 3000 8888)
for port in "${test_ports[@]}"; do
    export PORT=$port
    if config=$(docker compose config 2>&1) && echo "$config" | grep -q "\"$port:$port\""; then
        echo -e "${GREEN}✓ 端口 $port 配置正确${NC}"
    else
        echo -e "${RED}✗ 端口 $port 配置异常${NC}"
    fi
done
unset PORT

# 验证目录配置
echo -e "\n${YELLOW}5. 验证目录配置...${NC}"

# 测试 DOCS_DIR
export DOCS_DIR="/test/docs"
if config=$(docker compose config 2>&1) && \
   echo "$config" | grep -q '/test/docs/src:/app/src' && \
   echo "$config" | grep -q '/test/docs/clients:/app/clients'; then
    echo -e "${GREEN}✓ DOCS_DIR 配置正确${NC}"
else
    echo -e "${RED}✗ DOCS_DIR 配置异常${NC}"
fi
unset DOCS_DIR

# 测试个别目录变量
export SRC_DIR="/custom/src"
export CLIENTS_DIR="/custom/clients"
if config=$(docker compose config 2>&1) && \
   echo "$config" | grep -q '/custom/src:/app/src' && \
   echo "$config" | grep -q '/custom/clients:/app/clients'; then
    echo -e "${GREEN}✓ 个别目录变量配置正确${NC}"
else
    echo -e "${RED}✗ 个别目录变量配置异常${NC}"
fi
unset SRC_DIR CLIENTS_DIR

# 验证目录优先级
echo -e "\n${YELLOW}6. 验证目录优先级...${NC}"
export DOCS_DIR="/base/docs"
export SRC_DIR="/override/src"
if config=$(docker compose config 2>&1) && \
   echo "$config" | grep -q '/override/src:/app/src' && \
   echo "$config" | grep -q '/base/docs/clients:/app/clients'; then
    echo -e "${GREEN}✓ 目录优先级配置正确（个别变量优先于 DOCS_DIR）${NC}"
else
    echo -e "${RED}✗ 目录优先级配置异常${NC}"
fi
unset DOCS_DIR SRC_DIR

# 验证健康检查端口
echo -e "\n${YELLOW}7. 验证健康检查端口...${NC}"
export PORT=9001
if config=$(docker compose config 2>&1) && echo "$config" | grep -q 'http://localhost:9001/'; then
    echo -e "${GREEN}✓ 健康检查端口配置正确${NC}"
else
    echo -e "${RED}✗ 健康检查端口配置异常${NC}"
fi
unset PORT

echo -e "\n${CYAN}===========================================${NC}"
echo -e "${CYAN}向后兼容性验证完成${NC}"
echo -e "${CYAN}===========================================${NC}"

echo -e "\n${YELLOW}测试建议:${NC}"
echo -e "${NC}1. 运行 'docker compose config' 验证当前配置${NC}"
echo -e "${NC}2. 使用 'docker compose up -d' 测试服务启动${NC}"
echo -e "${NC}3. 检查 'docker compose ps' 确认服务状态${NC}"
echo -e "${NC}4. 访问 http://localhost:8080 验证服务可用性${NC}"