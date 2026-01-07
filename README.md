# 运维文档生成系统

一个自动化的运维文档构建系统，支持将 Markdown 文档模块组合并输出为 Word 或 PDF 格式，为不同客户/项目定制文档。

## 功能特性

- 📝 **模块化文档**: 将运维文档拆分为独立模块（架构、日常运维、故障处理等）
- 🎨 **多客户支持**: 为不同客户配置专属的文档组合和元数据
- 🔧 **自动化构建**: 通过命令一键生成 Word 或 PDF 文档
- 📄 **PDF 输出**: 支持 PDF 格式输出，含代码高亮、封面、目录等专业排版
- 🌐 **Web 界面**: 提供可视化界面，选择客户和文档类型即可生成
- � ***Docker 支持**: 提供 Docker 镜像，支持卷挂载自定义文档
- 🚀 **CI/CD 集成**: 支持 GitHub Actions / GitLab CI 自动构建

## 目录结构

```
project-root/
├── build.ps1                   # Windows 构建脚本
├── Makefile                    # Linux/macOS 构建入口
├── README.md                   # 项目说明
│
├── src/                        # 文档源码目录
│   ├── metadata.yaml           # 默认元数据
│   ├── 01-概述.md              # 概述
│   ├── 02-系统架构.md          # 系统架构
│   ├── 03-日常运维.md          # 日常运维
│   ├── 04-故障处理.md          # 故障处理
│   ├── 05-监控告警.md          # 监控告警
│   ├── 06-备份恢复.md          # 备份恢复
│   ├── 07-安全规范.md          # 安全规范
│   ├── 08-部署上线.md          # 部署上线
│   ├── 09-应急预案.md          # 应急预案
│   ├── 10-项目背景.md          # 项目背景
│   ├── 11-联系人.md            # 联系人信息
│   └── images/                 # 图片资源
│
├── clients/                    # 客户配置目录
│   ├── default/                # 默认配置
│   │   └── config.yaml
│   └── 标准文档/               # 标准文档模板
│       ├── config.yaml         # 文档配置
│       └── metadata.yaml       # 元数据覆盖
│
├── templates/                  # Word 模板目录
│   └── default.docx
│
├── bin/                        # 构建脚本
│   └── build.sh
│
├── web/                        # Web 界面（Go）
│   ├── main.go                 # 入口文件
│   ├── static/                 # 前端资源
│   └── README.md               # Web 使用说明
│
└── build/                      # 输出目录
```

## 快速开始

### 1. 安装依赖

**Pandoc** (必需):
```bash
# Windows (PowerShell)
choco install pandoc

# Debian/Ubuntu
sudo apt install pandoc

# CentOS/RHEL
sudo yum install -y epel-release
sudo yum install -y pandoc

# macOS
brew install pandoc
```

**PDF 输出依赖** (可选，仅生成 PDF 时需要):
```bash
# Windows (PowerShell)
choco install texlive
# 安装 Eisvogel 模板
$templateDir = "$env:APPDATA\pandoc\templates"
New-Item -ItemType Directory -Path $templateDir -Force
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/Wandmalfarbe/pandoc-latex-template/master/eisvogel.latex" -OutFile "$templateDir\eisvogel.latex"

# Debian/Ubuntu
sudo apt install texlive-xetex texlive-fonts-recommended fonts-noto-cjk
mkdir -p ~/.local/share/pandoc/templates
wget -O ~/.local/share/pandoc/templates/eisvogel.latex \
  https://raw.githubusercontent.com/Wandmalfarbe/pandoc-latex-template/master/eisvogel.latex

# CentOS/RHEL
sudo yum install -y epel-release
sudo yum install -y texlive-xetex texlive-collection-fontsrecommended google-noto-sans-cjk-fonts
mkdir -p ~/.local/share/pandoc/templates
wget -O ~/.local/share/pandoc/templates/eisvogel.latex \
  https://raw.githubusercontent.com/Wandmalfarbe/pandoc-latex-template/master/eisvogel.latex

# macOS
brew install --cask mactex
brew install font-noto-sans-cjk
mkdir -p ~/.local/share/pandoc/templates
wget -O ~/.local/share/pandoc/templates/eisvogel.latex \
  https://raw.githubusercontent.com/Wandmalfarbe/pandoc-latex-template/master/eisvogel.latex
```

**检查 PDF 依赖**:
```bash
# Windows
.\bin\check-pdf-deps.ps1

# Linux/macOS
./bin/check-pdf-deps.sh
```

### 2. 构建文档

**Windows:**
```powershell
# 使用默认配置构建 Word
.\build.ps1

# 构建 PDF
.\build.ps1 -Format pdf

# 指定客户构建
.\build.ps1 -Client 标准文档
.\build.ps1 -Client 标准文档 -Format pdf

# 检查 PDF 依赖
.\build.ps1 -CheckPdfDeps

# 查看帮助
.\build.ps1 -Help
```

**Linux/macOS:**
```bash
# 初始化
make init
make init-template

# 构建 Word
make
make client=标准文档

# 构建 PDF
make format=pdf
make client=标准文档 format=pdf

# 检查 PDF 依赖
make check-pdf-deps
```

### 3. 查看输出

构建完成后，Word 文档保存在 `build/` 目录。

## Web 界面

除了命令行，还可以使用 Web 界面生成文档。

### 方式一：使用预编译二进制

从 [GitHub Releases](../../releases) 下载对应平台的 zip 包，解压后直接运行：

```bash
# Linux
unzip doc-generator-web-linux-amd64.zip
cd linux-amd64
./doc-generator-web

# Windows
# 解压 doc-generator-web-windows-amd64.zip
cd windows-amd64
doc-generator-web.exe
```

解压后的目录结构：
```
linux-amd64/
├── doc-generator-web    # 可执行文件
└── static/              # 静态资源（必需）
    ├── index.html
    ├── app.js
    └── style.css
```

### 方式二：Docker 运行

```bash
# 使用 Docker Compose（推荐）
docker compose up -d

# 或直接运行镜像
docker run -p 8080:8080 \
  -v ./src:/app/src \
  -v ./clients:/app/clients \
  -v ./templates:/app/templates \
  -v ./build:/app/build \
  ghcr.io/<owner>/<repo>:latest
```

### 方式三：从源码构建

```bash
# 进入 web 目录构建
cd web
go build -o doc-generator-web .

# 回到项目根目录运行
cd ..
./web/doc-generator-web      # Linux/macOS
web\doc-generator-web.exe    # Windows
```

访问 http://localhost:8080 即可使用。

### Web 功能

- 选择客户和文档类型
- 选择输出格式（Word/PDF）
- 一键生成并下载文档
- 创建新客户配置
- 实时显示配置更新

详细说明见 [web/README.md](web/README.md)

## Docker 部署

### 使用 Docker Compose

```bash
# 启动服务（本地构建镜像）
docker compose up -d

# 使用指定镜像
IMAGE=ghcr.io/<owner>/<repo>:latest docker compose up -d

# 查看日志
docker compose logs -f

# 停止服务
docker compose down
```

### 卷挂载说明

可以挂载以下目录来自定义文档内容：

| 容器路径 | 说明 |
|---------|------|
| `/app/src` | 文档源文件 (*.md) |
| `/app/clients` | 客户配置目录 |
| `/app/templates` | Word 模板 |
| `/app/build` | 输出目录（建议挂载） |

示例：
```bash
docker run -p 8080:8080 \
  -v /path/to/your/src:/app/src \
  -v /path/to/your/clients:/app/clients \
  -v /path/to/your/templates:/app/templates \
  -v /path/to/output:/app/build \
  ghcr.io/<owner>/<repo>:latest
```

### 构建自定义镜像

```bash
docker build -t doc-generator -f web/Dockerfile .
```

## 常用命令

### Windows (PowerShell)

| 命令 | 说明 |
|------|------|
| `.\build.ps1` | 使用默认配置构建 Word |
| `.\build.ps1 -Format pdf` | 构建 PDF 格式 |
| `.\build.ps1 -Client xxx` | 指定客户构建 |
| `.\build.ps1 -Client xxx -Format pdf` | 指定客户构建 PDF |
| `.\build.ps1 -Client xxx -Doc 文档名` | 构建指定文档 |
| `.\build.ps1 -Client xxx -ListDocs` | 列出客户的文档类型 |
| `.\build.ps1 -Client xxx -BuildAll` | 构建客户所有文档 |
| `.\build.ps1 -ListClients` | 列出所有客户 |
| `.\build.ps1 -ListModules` | 列出所有文档模块 |
| `.\build.ps1 -CheckPdfDeps` | 检查 PDF 依赖 |
| `.\build.ps1 -Clean` | 清理构建目录 |
| `.\build.ps1 -InitTemplate` | 生成默认模板 |

### Linux/macOS (Make)

| 命令 | 说明 |
|------|------|
| `make` | 使用默认配置构建 Word |
| `make format=pdf` | 构建 PDF 格式 |
| `make client=xxx` | 指定客户构建 |
| `make client=xxx format=pdf` | 指定客户构建 PDF |
| `make list-clients` | 列出所有客户 |
| `make list-modules` | 列出所有文档模块 |
| `make check-pdf-deps` | 检查 PDF 依赖 |
| `make clean` | 清理构建目录 |
| `make init-template` | 生成默认模板 |
| `make help` | 显示帮助 |

## 添加新客户

1. 复制 `clients/标准文档/` 目录
2. 重命名为客户名称
3. 修改 `config.yaml` 选择需要的章节
4. 修改 `metadata.yaml` 设置客户信息
5. 运行构建命令

## 一个客户多个文档

在客户目录下创建多个 `.yaml` 配置文件：

```
clients/某客户/
├── config.yaml       # 默认文档
├── metadata.yaml     # 共享元数据
├── 运维手册.yaml     # 运维手册配置
├── 应急预案.yaml     # 应急预案配置
└── 交接文档.yaml     # 交接文档配置
```

构建指定文档：
```powershell
.\build.ps1 -Client 某客户 -Doc 运维手册
.\build.ps1 -Client 某客户 -BuildAll  # 构建所有
```

## 文档模块说明

| 模块 | 内容 |
|------|------|
| 01-概述.md | 文档概述、适用范围、联系方式 |
| 02-系统架构.md | 系统架构、服务器清单、网络拓扑 |
| 03-日常运维.md | 日常巡检、常用命令、变更管理 |
| 04-故障处理.md | 故障分级、常见故障处理、复盘模板 |
| 05-监控告警.md | 监控体系、告警阈值、值班安排 |
| 06-备份恢复.md | 备份策略、恢复流程、演练计划 |
| 07-安全规范.md | 访问控制、安全检查、应急响应 |
| 08-部署上线.md | 部署流程、上线检查、回滚方案 |
| 09-应急预案.md | 应急预案、故障升级、灾难恢复 |
| 10-项目背景.md | 项目背景、业务说明、系统演进 |
| 11-联系人.md | 联系人清单、值班表、供应商信息 |

## PDF 配置选项

在客户的 `metadata.yaml` 或文档配置文件中添加 `pdf_options` 节来自定义 PDF 输出：

```yaml
pdf_options:
  # 字体设置
  mainfont: "Noto Sans CJK SC"
  CJKmainfont: "Noto Sans CJK SC"
  monofont: "Noto Sans Mono CJK SC"
  
  # 封面设置
  titlepage: true
  titlepage-color: "2C3E50"
  titlepage-text-color: "FFFFFF"
  # titlepage-logo: "images/logo.png"
  
  # 页面设置
  geometry: "margin=2.5cm"
  fontsize: "11pt"
  linestretch: 1.25
  
  # 目录设置
  toc: true
  toc-depth: 3
```

完整配置示例见 `clients/标准文档/PDF示例.yaml`。

## 许可证

MIT License
