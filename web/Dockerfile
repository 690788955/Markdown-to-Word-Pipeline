# ==========================================
# 运维文档生成系统 - Docker 构建文件
# ==========================================
# 多阶段构建，优化镜像大小

# 阶段1: 构建 Go 应用
FROM golang:1.21-alpine AS builder

WORKDIR /build

# 复制 Go 模块文件
COPY web/go.mod web/go.sum ./
RUN go mod download

# 复制源代码
COPY web/ ./

# 构建应用
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o doc-generator-web .

# 阶段2: 运行时镜像
FROM pandoc/latex:latest

# 安装 make（用于构建文档）
RUN apk add --no-cache make bash

WORKDIR /app

# 从构建阶段复制可执行文件
COPY --from=builder /build/doc-generator-web /app/

# 复制项目文件
COPY Makefile /app/
COPY scripts/ /app/scripts/
COPY src/ /app/src/
COPY templates/ /app/templates/
COPY clients/ /app/clients/

# 创建 build 目录
RUN mkdir -p /app/build

# 设置脚本执行权限
RUN chmod +x /app/scripts/*.sh

# 设置环境变量
ENV PORT=8080
ENV WORK_DIR=/app

# 暴露端口
EXPOSE 8080

# 启动应用
CMD ["/app/doc-generator-web"]
