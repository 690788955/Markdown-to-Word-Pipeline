# ==========================================
# Markdown to Word Pipeline - Makefile
# ==========================================

# 配置区域
# ==========================================

# 默认客户配置
client ?= default

# 目录设置
SRC_DIR := src
CLIENTS_DIR := clients
TEMPLATES_DIR := templates
BUILD_DIR := build

# Pandoc 可执行文件
PANDOC := pandoc

# 客户配置文件路径
CLIENT_DIR := $(CLIENTS_DIR)/$(client)
CONFIG_FILE := $(CLIENT_DIR)/config.yaml
CLIENT_META := $(CLIENT_DIR)/metadata.yaml

# 默认模板
DEFAULT_TEMPLATE := $(TEMPLATES_DIR)/default.docx

# ==========================================
# 主要目标
# ==========================================

# 默认目标
.PHONY: all
all: build

# 构建文档
.PHONY: build
build: check-deps check-config dir
	@echo "=========================================="
	@echo "Building document for client: $(client)"
	@echo "=========================================="
	@./scripts/build.sh "$(client)"

# ==========================================
# 检查和验证
# ==========================================

# 检查依赖
.PHONY: check-deps
check-deps:
	@command -v $(PANDOC) >/dev/null 2>&1 || { \
		echo "[ERROR] Pandoc not found. Please install Pandoc first."; \
		echo "Visit: https://pandoc.org/installing.html"; \
		echo "Or run: sudo apt install pandoc (Debian/Ubuntu)"; \
		exit 1; \
	}

# 检查客户配置
.PHONY: check-config
check-config:
	@if [ ! -d "$(CLIENT_DIR)" ]; then \
		echo "[ERROR] Client config not found: $(client)"; \
		echo "Available clients:"; \
		$(MAKE) -s list-clients; \
		exit 1; \
	fi

# ==========================================
# 目录管理
# ==========================================

# 创建输出目录
.PHONY: dir
dir:
	@mkdir -p $(BUILD_DIR)
	@mkdir -p scripts

# 清理构建产物
.PHONY: clean
clean:
	@echo "Cleaning build directory..."
	@rm -f $(BUILD_DIR)/*.docx $(BUILD_DIR)/*.pdf $(BUILD_DIR)/*.html
	@echo "Done."

# ==========================================
# 列表命令
# ==========================================

# 列出所有客户配置
.PHONY: list-clients
list-clients:
	@echo "Available clients:"
	@for dir in $(CLIENTS_DIR)/*/; do \
		echo "  - $$(basename $$dir)"; \
	done

# 列出所有文档模块
.PHONY: list-modules
list-modules:
	@echo "Available modules in $(SRC_DIR)/:"
	@find $(SRC_DIR) -maxdepth 1 \( -name "*.md" -o -name "*.yaml" \) -type f | while read f; do \
		echo "  - $$f"; \
	done

# ==========================================
# 初始化
# ==========================================

# 初始化默认模板
.PHONY: init-template
init-template: check-deps
	@echo "Generating default Word template..."
	@mkdir -p $(TEMPLATES_DIR)
	@echo "# Template" | $(PANDOC) -o $(DEFAULT_TEMPLATE)
	@echo "Template created: $(DEFAULT_TEMPLATE)"

# 设置脚本执行权限
.PHONY: init
init: dir
	@chmod +x scripts/build.sh 2>/dev/null || true
	@echo "Project initialized."

# ==========================================
# 帮助信息
# ==========================================

.PHONY: help
help:
	@echo "=========================================="
	@echo "Markdown to Word Pipeline"
	@echo "=========================================="
	@echo ""
	@echo "Usage: make [target] [client=CLIENT_NAME]"
	@echo ""
	@echo "Targets:"
	@echo "  make              Build with default client config"
	@echo "  make client=xxx   Build with specified client config"
	@echo "  make list-clients List all available client configs"
	@echo "  make list-modules List all document modules"
	@echo "  make clean        Clean build artifacts"
	@echo "  make init-template Generate default Word template"
	@echo "  make init         Initialize project (set permissions)"
	@echo "  make help         Show this help message"
	@echo ""
	@echo "Examples:"
	@echo "  make"
	@echo "  make client=example-client"
	@echo "  make clean"
	@echo ""

# 伪目标声明
.PHONY: all build check-deps check-config dir clean list-clients list-modules init-template init help
