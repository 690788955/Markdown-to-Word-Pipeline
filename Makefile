# ==========================================
# 运维文档生成系统 - Makefile
# ==========================================

# 配置区域
# ==========================================

# 默认客户配置
client ?= default
# 文档类型（可选）
doc ?=

# 目录设置
SRC_DIR := src
CLIENTS_DIR := clients
TEMPLATES_DIR := templates
BUILD_DIR := build

# Pandoc 可执行文件
PANDOC := pandoc

# 客户配置文件路径
CLIENT_DIR := $(CLIENTS_DIR)/$(client)

# ==========================================
# 主要目标
# ==========================================

.PHONY: all
all: build

.PHONY: build
build: check-deps check-config dir
	@echo "=========================================="
	@echo "构建文档 - 客户: $(client)"
	@echo "=========================================="
	@./scripts/build.sh "$(client)" "$(doc)"

# ==========================================
# 检查和验证
# ==========================================

.PHONY: check-deps
check-deps:
	@command -v $(PANDOC) >/dev/null 2>&1 || { \
		echo "[错误] 未找到 Pandoc，请先安装"; \
		echo "安装: sudo apt install pandoc"; \
		exit 1; \
	}

.PHONY: check-config
check-config:
	@if [ ! -d "$(CLIENT_DIR)" ]; then \
		echo "[错误] 客户配置不存在: $(client)"; \
		echo "可用客户:"; \
		$(MAKE) -s list-clients; \
		exit 1; \
	fi

# ==========================================
# 目录管理
# ==========================================

.PHONY: dir
dir:
	@mkdir -p $(BUILD_DIR)
	@mkdir -p scripts

.PHONY: clean
clean:
	@echo "清理构建目录..."
	@rm -rf $(BUILD_DIR)
	@echo "完成。"

# ==========================================
# 列表命令
# ==========================================

.PHONY: list-clients
list-clients:
	@echo "可用客户:"
	@for dir in $(CLIENTS_DIR)/*/; do \
		echo "  - $$(basename $$dir)"; \
	done

.PHONY: list-modules
list-modules:
	@echo "可用文档模块 ($(SRC_DIR)/):"
	@find $(SRC_DIR) -maxdepth 1 \( -name "*.md" -o -name "*.yaml" \) -type f | sort | while read f; do \
		echo "  - $$f"; \
	done

.PHONY: list-docs
list-docs:
	@echo "客户 [$(client)] 的文档类型:"
	@for f in $(CLIENT_DIR)/*.yaml; do \
		name=$$(basename "$$f" .yaml); \
		if [ "$$name" = "metadata" ]; then continue; fi; \
		if [ "$$name" = "config" ]; then \
			echo "  - (默认)"; \
		else \
			echo "  - $$name"; \
		fi; \
	done

# ==========================================
# 初始化
# ==========================================

.PHONY: init-template
init-template: check-deps
	@echo "生成默认 Word 模板..."
	@mkdir -p $(TEMPLATES_DIR)
	@echo "# Template" | $(PANDOC) -o $(TEMPLATES_DIR)/default.docx
	@echo "模板已创建: $(TEMPLATES_DIR)/default.docx"

.PHONY: init
init: dir
	@chmod +x scripts/build.sh 2>/dev/null || true
	@echo "项目已初始化。"

# ==========================================
# 帮助信息
# ==========================================

.PHONY: help
help:
	@echo "=========================================="
	@echo "运维文档生成系统"
	@echo "=========================================="
	@echo ""
	@echo "用法: make [目标] [client=客户名] [doc=文档类型]"
	@echo ""
	@echo "目标:"
	@echo "  make                    使用默认配置构建"
	@echo "  make client=xxx         指定客户构建"
	@echo "  make client=xxx doc=yyy 构建指定文档类型"
	@echo "  make list-clients       列出所有客户"
	@echo "  make list-modules       列出所有文档模块"
	@echo "  make list-docs client=x 列出客户的文档类型"
	@echo "  make clean              清理构建目录"
	@echo "  make init-template      生成默认模板"
	@echo "  make init               初始化项目"
	@echo "  make help               显示帮助"
	@echo ""
	@echo "示例:"
	@echo "  make"
	@echo "  make client=example-client"
	@echo "  make client=example-client doc=运维手册"
	@echo "  make client=example-client doc=部署手册"
	@echo "  make client=example-client doc=应急预案"
	@echo "  make client=example-client doc=日常巡检"
	@echo "  make client=example-client doc=交接文档"
	@echo "  make list-docs client=example-client"
	@echo ""
	@echo "文档模块:"
	@echo "  01-概述.md       概述、适用范围"
	@echo "  02-系统架构.md   系统架构、服务器清单"
	@echo "  03-日常运维.md   日常巡检、常用命令"
	@echo "  04-故障处理.md   故障分级、处理流程"
	@echo "  05-监控告警.md   监控体系、告警阈值"
	@echo "  06-备份恢复.md   备份策略、恢复流程"
	@echo "  07-安全规范.md   访问控制、安全检查"
	@echo "  08-部署上线.md   部署流程、回滚方案"
	@echo "  09-应急预案.md   应急响应、灾难恢复"
	@echo "  10-项目背景.md   项目背景、业务说明"
	@echo "  11-联系人.md     联系人清单、值班表"
	@echo ""
