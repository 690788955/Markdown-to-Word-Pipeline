# 运维文档生成系统

一个自动化的运维文档构建系统，支持将 Markdown 文档模块组合并输出为 Word 或 PDF 格式，为不同客户/项目定制文档。

## 功能特性

- 📝 **模块化文档**: 将运维文档拆分为独立模块（架构、日常运维、故障处理等）
- 🎨 **多客户支持**: 为不同客户配置专属的文档组合和元数据
- 🔧 **自动化构建**: 通过命令一键生成 Word 或 PDF 文档
- 📄 **PDF 输出**: 支持 PDF 格式输出，含代码高亮、封面、目录等专业排版
- 🌐 **Web 界面**: 现代化响应式界面，支持深色模式，移动端友好
- 🐳 **Docker 支持**: 提供 Docker 镜像，支持卷挂载自定义文档
- 🚀 **CI/CD 集成**: 支持 GitHub Actions / GitLab CI 自动构建
- 🔐 **配置锁定**: 支持密码保护客户配置，防止误修改

## 技术栈

| 组件 | 技术 |
|------|------|
| 文档处理 | Pandoc (Markdown → Word/PDF) |
| PDF 引擎 | XeLaTeX + Eisvogel 模板 |
| Web 后端 | Go 1.21+ (标准库 net/http) |
| Web 前端 | 原生 HTML/CSS/JavaScript |
| 配置格式 | YAML |
| 容器化 | Docker + Docker Compose |

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
│   │   └── 默认文档.yaml
│   └── 标准文档/               # 标准文档模板
│       ├── 运维手册.yaml       # 运维手册配置
│       ├── 部署手册.yaml       # 部署手册配置
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

> **推荐方式**: 使用 Docker 镜像（已包含所有依赖），或下载官方 TeX Live 二进制包安装。
> 系统包管理器（yum/apt）的 texlive 版本较旧，可能缺少必要的 LaTeX 包。

#### 方式一：Docker（推荐，零配置）

使用项目提供的 Docker 镜像，已包含完整的 TeX Live 和所有依赖：

```bash
docker compose up -d
# 访问 http://localhost:8080 使用 Web 界面生成 PDF
```

#### 方式二：下载 TeX Live 官方二进制包（推荐）

从 TeX Live 官网下载完整版，包含所有必要的 LaTeX 包：

**Linux:**
```bash
# 1. 下载安装包
cd /tmp
wget https://mirror.ctan.org/systems/texlive/tlnet/install-tl-unx.tar.gz
tar -xzf install-tl-unx.tar.gz
cd install-tl-*

# 2. 运行安装程序（完整安装约 7GB，可选择 scheme-medium 约 2GB）
sudo ./install-tl
# 安装过程中可以选择:
# - scheme-full: 完整安装（推荐，约 7GB）
# - scheme-medium: 中等安装（约 2GB）
# - scheme-basic + 手动安装包

# 3. 添加到 PATH（根据安装路径调整）
echo 'export PATH="/usr/local/texlive/2024/bin/x86_64-linux:$PATH"' >> ~/.bashrc
source ~/.bashrc

# 4. 安装 Eisvogel 模板
mkdir -p ~/.local/share/pandoc/templates
wget -O ~/.local/share/pandoc/templates/eisvogel.latex \
  https://github.com/Wandmalfarbe/pandoc-latex-template/releases/download/2.4.2/Eisvogel-2.4.2.tar.gz
cd ~/.local/share/pandoc/templates
tar -xzf eisvogel.latex && mv Eisvogel-*/eisvogel.latex . && rm -rf Eisvogel-* eisvogel.latex.tar.gz
# 或直接下载
wget -O ~/.local/share/pandoc/templates/eisvogel.latex \
  https://raw.githubusercontent.com/Wandmalfarbe/pandoc-latex-template/master/eisvogel.latex

# 5. 安装中文字体
sudo yum install -y google-noto-sans-cjk-fonts  # CentOS/RHEL
sudo apt install -y fonts-noto-cjk              # Debian/Ubuntu
```

**Windows:**
```powershell
# 1. 下载 TeX Live 安装程序
# 访问 https://www.tug.org/texlive/acquire-netinstall.html
# 下载 install-tl-windows.exe 并运行

# 2. 安装 Eisvogel 模板
$templateDir = "$env:APPDATA\pandoc\templates"
New-Item -ItemType Directory -Path $templateDir -Force
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/Wandmalfarbe/pandoc-latex-template/master/eisvogel.latex" `
  -OutFile "$templateDir\eisvogel.latex"
```

**macOS:**
```bash
# 1. 下载 MacTeX（完整 TeX Live）
# 访问 https://www.tug.org/mactex/ 下载 MacTeX.pkg 安装
# 或使用 Homebrew:
brew install --cask mactex

# 2. 安装 Eisvogel 模板
mkdir -p ~/.local/share/pandoc/templates
curl -L -o ~/.local/share/pandoc/templates/eisvogel.latex \
  https://raw.githubusercontent.com/Wandmalfarbe/pandoc-latex-template/master/eisvogel.latex
```

#### 方式三：系统包管理器（可能缺包）

```bash
# Debian/Ubuntu
sudo apt install texlive-xetex texlive-latex-extra texlive-fonts-extra fonts-noto-cjk

# CentOS/RHEL（包较旧，可能需要手动补充 sty 文件）
sudo yum install -y texlive-xetex texlive-collection-latexextra

# macOS
brew install --cask mactex
```

如果遇到 `xxx.sty not found` 错误，需要手动下载缺失的包：
```bash
# 例如缺少 footnotebackref.sty
sudo mkdir -p /usr/share/texlive/texmf-local/tex/latex/footnotebackref
sudo curl -o /usr/share/texlive/texmf-local/tex/latex/footnotebackref/footnotebackref.sty \
  https://mirrors.ctan.org/macros/latex/contrib/footnotebackref/footnotebackref.sty
sudo mktexlsr
```

**检查 PDF 依赖**:
```bash
# Windows
.\build.ps1 -CheckPdfDeps

# Linux/macOS
./bin/build.sh --check-pdf-deps
```

**更新 Eisvogel 模板** (解决版本兼容性问题):
```bash
# Windows
.\bin\update-eisvogel.ps1

# Linux/macOS
./bin/update-eisvogel.sh
```

> **关于模板路径**: Eisvogel 模板需要放在 Pandoc 的用户模板目录中：
> - Windows: `%APPDATA%\pandoc\templates\eisvogel.latex`
> - Linux/macOS: `~/.local/share/pandoc/templates/eisvogel.latex`
> 
> 这是 Pandoc 的标准模板搜索路径，所有项目都可以共用同一个模板。

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
- 创建和编辑客户配置
- 穿梭框式模块选择，支持拖拽排序
- 变量模板填写
- 实时文件名预览
- 深色模式自动适配
- 移动端响应式布局
- Toast 通知和加载动画

详细说明见 [web/README.md](web/README.md)

## Docker 部署

### 使用 Docker Compose

#### 基本使用

```bash
# 启动服务（本地构建镜像，默认配置）
docker compose up -d

# 使用指定镜像
IMAGE=ghcr.io/<owner>/<repo>:latest docker compose up -d

# 查看日志
docker compose logs -f

# 停止服务
docker compose down
```

#### 环境变量配置

Docker Compose 现在支持通过环境变量灵活配置端口和目录：

```bash
# 自定义端口
PORT=9000 docker compose up -d

# 自定义文档目录（单一根目录）
DOCS_DIR=/home/user/documents docker compose up -d

# 分别指定各目录（精细控制）
SRC_DIR=/custom/src \
CLIENTS_DIR=/custom/clients \
TEMPLATES_DIR=/custom/templates \
OUTPUT_DIR=/custom/output \
docker compose up -d

# 组合配置示例
PORT=9001 \
DOCS_DIR=/projects/project-a/docs \
OUTPUT_DIR=/shared/output/project-a \
docker compose up -d
```

#### 支持的环境变量

| 变量名 | 说明 | 默认值 | 示例 |
|--------|------|--------|------|
| `PORT` | 服务端口 | `8080` | `PORT=9000` |
| `DOCS_DIR` | 文档根目录 | `.` (当前目录) | `DOCS_DIR=/home/user/docs` |
| `SRC_DIR` | 源文档目录 | `${DOCS_DIR}/src` 或 `./src` | `SRC_DIR=/custom/src` |
| `CLIENTS_DIR` | 客户配置目录 | `${DOCS_DIR}/clients` 或 `./clients` | `CLIENTS_DIR=/custom/clients` |
| `TEMPLATES_DIR` | 模板目录 | `${DOCS_DIR}/templates` 或 `./templates` | `TEMPLATES_DIR=/custom/templates` |
| `OUTPUT_DIR` | 输出目录 | `./build` | `OUTPUT_DIR=/shared/output` |
| `IMAGE` | 自定义镜像 | `doc-generator:latest` | `IMAGE=registry.com/doc-gen:v1.0` |

#### 配置优先级

```
个别目录变量 > DOCS_DIR > 默认项目结构
```

例如：如果同时设置了 `DOCS_DIR=/base/docs` 和 `SRC_DIR=/custom/src`，则：
- `src` 目录使用 `/custom/src`（个别变量优先）
- `clients` 目录使用 `/base/docs/clients`（DOCS_DIR 子目录）
- `templates` 目录使用 `/base/docs/templates`（DOCS_DIR 子目录）

#### 部署场景示例

**开发环境**（默认配置）：
```bash
docker compose up -d
# 访问: http://localhost:8080
```

**生产环境**（自定义端口和输出）：
```bash
PORT=9000 OUTPUT_DIR=/var/lib/doc-generator/output docker compose up -d
# 访问: http://localhost:9000
```

**多项目环境**（完全隔离）：
```bash
# 项目 A
PORT=9001 DOCS_DIR=/projects/project-a/docs OUTPUT_DIR=/shared/output/project-a docker compose up -d

# 项目 B  
PORT=9002 DOCS_DIR=/projects/project-b/docs OUTPUT_DIR=/shared/output/project-b docker compose up -d
```

**CI/CD 环境**（分离的目录结构）：
```bash
PORT=8080 \
SRC_DIR=/workspace/docs/modules \
CLIENTS_DIR=/workspace/configs/clients \
TEMPLATES_DIR=/workspace/templates \
OUTPUT_DIR=/workspace/artifacts \
IMAGE=registry.company.com/doc-generator:latest \
docker compose up -d
```

#### 配置验证

使用提供的验证脚本检查配置：

```bash
# Windows
.\validate-deployment.ps1 -Verbose

# Linux/macOS  
./validate-deployment.sh --verbose

# 仅检查配置（不启动服务）
.\validate-deployment.ps1 -CheckOnly
./validate-deployment.sh --check-only
```

#### 向后兼容性

新的环境变量配置完全向后兼容。如果不设置任何新的环境变量，Docker Compose 的行为与原版本完全相同。

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
3. 修改文档配置文件（如 `运维手册.yaml`）选择需要的章节
4. 修改 `metadata.yaml` 设置客户信息
5. 运行构建命令

## 一个客户多个文档

在客户目录下创建多个 `.yaml` 配置文件：

```
clients/某客户/
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
  # 字体设置（根据系统选择）
  # Windows: Microsoft YaHei, SimSun, SimHei
  # Linux: Noto Sans CJK SC, WenQuanYi Micro Hei
  # macOS: PingFang SC, Hiragino Sans GB
  mainfont: "Noto Sans CJK SC"
  CJKmainfont: "Noto Sans CJK SC"
  monofont: "Consolas"
  
  # 封面设置
  titlepage: true
  titlepage-color: "2C3E50"
  titlepage-text-color: "FFFFFF"
  titlepage-rule-color: "3498DB"
  # titlepage-logo: "images/logo.png"
  # logo-width: 100
  
  # 页面设置
  geometry: "margin=2.5cm"
  fontsize: "11pt"
  linestretch: 1.25
  
  # 代码块设置
  listings: true
  listings-no-page-break: true
  code-block-font-size: "\\small"
  
  # 目录设置
  toc: true
  toc-depth: 3
  toc-own-page: true
  
  # 链接设置
  colorlinks: true
  linkcolor: "2980B9"
  urlcolor: "3498DB"
```

## 变量模板功能

支持在 Markdown 文档中使用变量占位符，在构建时替换为实际值。

### 变量声明

在文档的 YAML front-matter 中声明变量：

```yaml
---
title: 运维手册
variables:
  project_name:
    description: 项目名称
    type: text
    default: XX系统
  
  server_count:
    description: 服务器数量
    type: number
    min: 1
    max: 100
    default: 3
  
  deploy_date:
    description: 部署日期
    type: date
    default: "2026-01-08"
  
  environment:
    description: 部署环境
    type: select
    options:
      - 开发环境
      - 测试环境
      - 生产环境
    default: 生产环境
---
```

### 变量类型

| 类型 | 说明 | 验证选项 |
|------|------|----------|
| `text` | 文本类型 | `pattern` (正则表达式) |
| `number` | 数字类型 | `min`, `max` (范围) |
| `date` | 日期类型 | 格式: YYYY-MM-DD |
| `select` | 选择类型 | `options` (选项列表) |

### 使用变量

在文档内容中使用双大括号引用变量：

```markdown
## 项目信息

- **项目名称**: {{project_name}}
- **服务器数量**: {{server_count}} 台
- **部署日期**: {{deploy_date}}
- **部署环境**: {{environment}}
```

### 转义语法

如需显示字面的双大括号，使用反斜杠转义：

```markdown
输入: \{{不替换}}
输出: {{不替换}}
```

### 命令行传递变量

**Windows (PowerShell):**
```powershell
.\build.ps1 -Client 标准文档 -Doc 变量示例 -Var "project_name=我的项目" -Var "version=v2.0"
```

**Linux/macOS (Bash):**
```bash
./bin/build.sh -c 标准文档 -d 变量示例 -V "project_name=我的项目" -V "version=v2.0"
```

### 配置文件中设置变量

在客户配置文件中预设变量值：

```yaml
# clients/某客户/运维手册.yaml
client_name: 某客户
modules:
  - src/01-概述.md
  - src/02-系统架构.md

# 变量默认值（覆盖模块中的默认值）
variables:
  project_name: 某客户系统
  environment: 生产环境
```

### 变量优先级

1. 命令行参数 (`-Var` / `-V`) - 最高优先级
2. 配置文件中的 `variables` 节
3. 模块 front-matter 中的 `default` 值

### Web 界面使用

1. 选择包含变量的文档模块
2. 在"变量设置"区域填写变量值
3. 点击"生成"按钮

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！详见 [CONTRIBUTING.md](CONTRIBUTING.md)

## 更新日志

详见 [CHANGELOG.md](CHANGELOG.md)
