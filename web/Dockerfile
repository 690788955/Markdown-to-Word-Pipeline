# ==========================================
# 运维文档生成系统 - Docker 构建文件
# 支持 Word 和 PDF 格式输出，支持 amd64/arm64 架构
# ==========================================
# 多阶段构建，优化镜像大小
#
# 使用方式:
#   # 构建镜像
#   docker build -t doc-generator -f web/Dockerfile .
#
#   # 运行（使用内置文档）
#   docker run -p 8080:8080 doc-generator
#
#   # 运行（挂载外部文档目录）
#   docker run -p 8080:8080 \
#     -v /path/to/your/src:/app/src \
#     -v /path/to/your/clients:/app/clients \
#     -v /path/to/your/templates:/app/templates \
#     -v /path/to/output:/app/build \
#     doc-generator

# 阶段1: 构建 Go 应用
FROM --platform=$BUILDPLATFORM golang:1.21-alpine AS builder

ARG TARGETPLATFORM
ARG TARGETOS
ARG TARGETARCH

WORKDIR /build

# 复制 Go 模块文件
COPY web/go.mod web/go.sum ./
RUN go mod download

# 复制源代码
COPY web/ ./

# 构建应用（交叉编译）
RUN CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} go build -ldflags="-w -s" -o doc-generator-web .

# 阶段2: 基础运行时镜像（共享依赖）
FROM alpine:3.19 AS base

# 安装基础工具和 Pandoc
RUN apk add --no-cache \
    make bash wget curl \
    pandoc \
    texlive-xetex \
    texmf-dist-latexextra \
    texmf-dist-fontsextra \
    font-noto-cjk \
    fontconfig

# 安装 Eisvogel 模板（PDF 生成必需）
RUN mkdir -p /root/.local/share/pandoc/templates && \
    wget -q -O /tmp/eisvogel.tar.gz \
    https://github.com/Wandmalfarbe/pandoc-latex-template/releases/download/2.4.2/Eisvogel-2.4.2.tar.gz && \
    tar -xzf /tmp/eisvogel.tar.gz -C /tmp && \
    cp /tmp/eisvogel.latex /root/.local/share/pandoc/templates/ && \
    rm -rf /tmp/eisvogel.tar.gz /tmp/eisvogel.latex /tmp/Eisvogel-*

# 更新字体缓存
RUN fc-cache -fv

WORKDIR /app

# 从构建阶段复制可执行文件
COPY --from=builder /build/doc-generator-web /app/

# 复制静态资源（Web 界面）
COPY web/static/ /app/static/

# 复制项目文件（作为默认内容，可被挂载覆盖）
COPY Makefile /app/
COPY bin/ /app/bin/
COPY src/ /app/src/
COPY templates/ /app/templates/
COPY clients/ /app/clients/

# 创建 build 目录（用于输出，建议挂载）
RUN mkdir -p /app/build

# 设置脚本执行权限并验证
RUN chmod +x /app/bin/*.sh 2>/dev/null || true && \
    echo "[Docker] bin 目录脚本权限已设置" && \
    ls -la /app/bin/*.sh 2>/dev/null || echo "[Docker] 无 .sh 脚本文件"

# 设置环境变量
ENV PORT=8080
ENV WORK_DIR=/app

# 可挂载的目录说明:
# /app/src       - 文档源文件 (*.md)
# /app/clients   - 客户配置目录
# /app/templates - Word 模板
# /app/build     - 输出目录

# 暴露端口
EXPOSE 8080

# 阶段3: 生产环境镜像
FROM base AS production

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q --spider http://localhost:8080/ || exit 1

# 启动应用
CMD ["/app/doc-generator-web"]

# 阶段4: 开发环境镜像（带热重载支持）
FROM base AS development

# 安装开发工具（如需要）
RUN apk add --no-cache git

# 开发环境健康检查（更宽松）
HEALTHCHECK --interval=60s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q --spider http://localhost:8080/ || exit 1

# 启动应用（开发模式）
CMD ["/app/doc-generator-web"]
