# Markdown-to-Word-Pipeline 项目上下文

> **最后更新**: 2026-02-11T15:57:07Z  
> **项目类型**: 文档生成系统  
> **技术栈**: Go + Pandoc + XeLaTeX + Vanilla JS

---

## 📋 项目概述

这是一个自动化的运维文档构建系统，支持将模块化的 Markdown 文档组合并输出为 Word 或 PDF 格式，为不同客户/项目定制文档。

### 核心功能

- **模块化文档**: 将运维文档拆分为独立模块（架构、日常运维、故障处理等）
- **多客户支持**: 为不同客户配置专属的文档组合和元数据
- **自动化构建**: 通过命令一键生成 Word 或 PDF 文档
- **Web 界面**: 现代化响应式界面，支持深色模式，移动端友好
- **变量模板**: 支持在文档中使用变量占位符，构建时动态替换
- **Git 集成**: 内置 Git 操作支持，可直接在 Web 界面管理文档版本
- **在线编辑器**: 支持在线编辑 Markdown 文档，实时预览和保存

### 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                        用户界面层                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Web UI      │  │  CLI (PS1)   │  │  CLI (Bash)  │      │
│  │  (浏览器)     │  │  (Windows)   │  │  (Linux/Mac) │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                      应用服务层                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Go Web Server (port 8080)                           │   │
│  │  ├─ API Handler (REST)                               │   │
│  │  ├─ Client Service (客户管理)                         │   │
│  │  ├─ Document Service (文档类型)                       │   │
│  │  ├─ Build Service (构建调度)                          │   │
│  │  ├─ Module Service (模块管理)                         │   │
│  │  ├─ Variable Service (变量处理)                       │   │
│  │  ├─ Editor Service (在线编辑)                         │   │
│  │  ├─ Git Service (版本控制)                            │   │
│  │  └─ Resource Service (资源管理)                       │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────┼──────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│                      构建引擎层                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Pandoc     │  │   XeLaTeX    │  │  Eisvogel    │      │
│  │  (转换引擎)   │  │  (PDF引擎)   │  │  (PDF模板)   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│                      数据存储层                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  src/        │  │  clients/    │  │  templates/  │      │
│  │  (源文档)     │  │  (客户配置)   │  │  (Word模板)  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │  build/      │  │  fonts/      │                        │
│  │  (输出文件)   │  │  (字体文件)   │                        │
│  └──────────────┘  └──────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 🗂️ 项目结构

```
Markdown-to-Word-Pipeline/
├── 📁 web/                      # Go Web 服务
│   ├── main.go                  # 入口文件
│   ├── go.mod                   # Go 模块定义
│   ├── config/
│   │   └── config.go            # 配置管理
│   ├── handler/
│   │   └── api.go               # API 处理器 (1708+ 行)
│   ├── service/
│   │   ├── build.go             # 构建服务 (843 行)
│   │   ├── client.go            # 客户服务 (354 行)
│   │   ├── document.go          # 文档服务
│   │   ├── module.go            # 模块服务
│   │   ├── template.go          # 模板服务
│   │   ├── config.go            # 配置服务
│   │   ├── variable.go          # 变量服务
│   │   ├── editor.go            # 编辑器服务
│   │   ├── git.go               # Git 服务
│   │   ├── resource.go          # 资源服务
│   │   └── pathfix.go           # 路径修复服务
│   ├── static/                  # 前端静态资源
│   │   ├── index.html           # 主页面
│   │   ├── editor.html          # 编辑器页面
│   │   ├── style.css            # 样式
│   │   ├── app.js               # 主应用逻辑
│   │   ├── editor.js            # 编辑器逻辑
│   │   ├── git.js               # Git 界面逻辑
│   │   ├── resource.js          # 资源管理逻辑
│   │   └── editor/              # 编辑器模块
│   │       ├── main.js          # 编辑器主逻辑
│   │       ├── vditor.js        # Vditor 集成
│   │       ├── tree.js          # 文件树
│   │       ├── tabs.js          # 标签页管理
│   │       ├── state.js         # 状态管理
│   │       ├── files.js         # 文件操作
│   │       ├── git.js           # Git 操作
│   │       ├── commands.js      # 命令面板
│   │       ├── quickopen.js     # 快速打开
│   │       ├── history.js       # 历史记录
│   │       ├── autosave.js      # 自动保存
│   │       ├── attachments.js   # 附件管理
│   │       ├── breadcrumb.js    # 面包屑导航
│   │       ├── theme.js         # 主题切换
│   │       ├── layout.js        # 布局管理
│   │       ├── loading.js       # 加载动画
│   │       ├── utils.js         # 工具函数
│   │       ├── virtual-tree.js  # 虚拟树
│   │       └── recent.js        # 最近文件
│   ├── Dockerfile               # Docker 构建文件
│   ├── entrypoint.sh            # Docker 入口脚本
│   └── README.md                # Web 服务文档
│
├── 📁 src/                      # 源文档目录
│   ├── metadata.yaml            # 默认元数据
│   ├── .editor-order.json       # 编辑器文件排序
│   ├── 01-概述.md
│   ├── 02-系统架构.md
│   ├── 03-日常运维.md
│   ├── 04-故障处理.md
│   ├── 05-监控告警.md
│   ├── 06-备份恢复.md
│   ├── 07-安全规范.md
│   ├── 08-部署上线.md
│   ├── 09-应急预案.md
│   ├── 10-项目背景.md
│   ├── 11-联系人.md
│   ├── 12-PDF功能示例.md
│   ├── 13-变量模板示例.md
│   ├── 01-运维/                 # 子目录示例
│   │   ├── 01-日常巡检.md
│   │   └── 02-变更管理.md
│   ├── 02-开发/
│   │   └── 01-编码规范.md
│   └── images/                  # 图片资源
│       └── README.md
│
├── 📁 clients/                  # 客户配置目录
│   ├── 标准文档/
│   │   ├── 运维手册-示例.yaml
│   │   ├── 部署手册.yaml
│   │   ├── 应急预案.yaml
│   │   ├── 日常巡检.yaml
│   │   ├── 交接文档.yaml
│   │   ├── 完整知识库.yaml
│   │   ├── PDF示例.yaml
│   │   ├── 变量示例.yaml
│   │   └── metadata.yaml        # 客户元数据
│   └── 测试客户/
│       ├── 变量测试.yaml
│       └── .custom              # 自定义配置标记
│
├── 📁 templates/                # Word 模板目录
│   ├── default.docx
│   └── README.md
│
├── 📁 bin/                      # 构建脚本目录
│   ├── build.sh                 # Linux/macOS 构建脚本
│   ├── build.ps1                # Windows 构建脚本
│   ├── check-pdf-deps.sh        # PDF 依赖检查
│   ├── check-pdf-deps.ps1
│   ├── install-fonts.sh         # 字体安装
│   ├── install-fonts.ps1
│   ├── update-eisvogel.sh       # Eisvogel 模板更新
│   ├── update-eisvogel.ps1
│   ├── fix-image-paths.sh       # 图片路径修复
│   ├── fix-image-paths.ps1
│   ├── validate-deployment.sh   # 部署验证
│   ├── validate-deployment.ps1
│   ├── validate-compatibility.sh # 兼容性验证
│   ├── validate-compatibility.ps1
│   └── README.md
│
├── 📁 fonts/                    # 字体文件目录
├── 📁 build/                    # 输出目录 (gitignored)
│
├── build.ps1                    # 根目录构建脚本 (Windows)
├── Makefile                     # 根目录构建脚本 (Linux/macOS)
├── docker-compose.yml           # Docker Compose 配置
├── .gitlab-ci.yml               # GitLab CI 配置
├── .gitignore                   # Git 忽略文件
├── README.md                    # 项目文档
├── CONTRIBUTING.md              # 贡献指南
└── AGENTS.md                    # AI 代理指南
```

---

## 🔑 核心模块说明

### 1. Web 服务模块 (`web/`)

#### 1.1 入口文件 (`main.go`)

**职责**: 
- 初始化配置
- 创建服务实例
- 注册路由
- 启动 HTTP 服务器

**关键逻辑**:
```go
// 工作目录优先级: 命令行参数 > 环境变量 > 可执行文件目录 > 当前目录
if *workDir != "" {
    cfg.WorkDir = *workDir
} else if os.Getenv("WORK_DIR") != "" {
    cfg.WorkDir = os.Getenv("WORK_DIR")
} else {
    // 自动检测逻辑
}
```

#### 1.2 API 处理器 (`handler/api.go`)

**职责**: 处理所有 HTTP 请求

**主要路由**:

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/clients` | GET | 获取客户列表 |
| `/api/clients/{name}/docs` | GET | 获取客户的文档类型列表 |
| `/api/generate` | POST | 生成文档（支持批量） |
| `/api/download/{filename}` | GET | 下载文档 |
| `/api/download-zip` | POST | 打包下载多个文档 |
| `/api/modules` | GET | 获取模块列表 |
| `/api/templates` | GET | 获取模板列表 |
| `/api/configs` | POST | 创建配置 |
| `/api/configs/{client}/{docType}` | GET/PUT/DELETE | 配置详情操作 |
| `/api/variables` | GET/POST | 提取变量声明 |
| `/api/lock/{clientName}` | GET/POST/DELETE | 客户锁定/解锁 |
| `/api/editor/module` | GET/PUT/POST | 编辑器模块操作 |
| `/api/editor/tree` | GET | 获取文件树 |
| `/api/editor/upload` | POST | 上传图片 |
| `/api/git/*` | * | Git 操作相关 |
| `/api/resources/*` | * | 资源管理相关 |

**错误代码**:
```go
const (
    ErrClientNotFound       = "CLIENT_NOT_FOUND"
    ErrDocTypeNotFound      = "DOC_TYPE_NOT_FOUND"
    ErrBuildFailed          = "BUILD_FAILED"
    ErrFileNotFound         = "FILE_NOT_FOUND"
    ErrInvalidInput         = "INVALID_INPUT"
    ErrClientExists         = "CLIENT_EXISTS"
    ErrDocTypeExists        = "DOC_TYPE_EXISTS"
    ErrConfigNotFound       = "CONFIG_NOT_FOUND"
    ErrPresetConfigReadonly = "PRESET_CONFIG_READONLY"
)
```

#### 1.3 构建服务 (`service/build.go`)

**职责**: 
- 调度文档构建
- 管理构建脚本
- 处理变量替换
- 清理过期文件

**关键特性**:
- 自动路径修复
- 变量替换支持（创建临时目录）
- 超时控制（默认 60 秒）
- 自动清理（24 小时后删除旧文件）

**构建流程**:
```
1. 检查并修复 Markdown 文件路径
2. 如果有变量，创建临时目录并替换变量
3. 根据操作系统选择构建脚本（build.ps1 或 build.sh）
4. 执行构建命令
5. 解析输出文件路径
6. 如果使用临时目录，复制输出到原始 build 目录
7. 清理临时目录
```

**脚本查找优先级**:
```
1. 可执行文件目录的 bin/ 目录
2. 可执行文件目录根
3. workDir 的 bin/ 目录
4. workDir 根目录
```

#### 1.4 客户服务 (`service/client.go`)

**职责**:
- 管理客户配置
- 读取客户元数据
- 创建新客户

**客户信息结构**:
```go
type Client struct {
    Name        string    // 目录名
    DisplayName string    // 显示名称
    ModifiedAt  time.Time // 最后修改时间
    IsCustom    bool      // 是否为自定义配置
    Locked      bool      // 是否已锁定
}
```

**特殊文件**:
- `.custom`: 标记为自定义配置
- `.locked`: 标记为已锁定（需要密码解锁）

#### 1.5 变量服务 (`service/variable.go`)

**职责**:
- 从 Markdown 文档中提取变量声明
- 渲染变量替换后的内容
- 验证变量值

**变量类型**:
- `text`: 文本类型
- `number`: 数字类型（支持 min/max 验证）
- `date`: 日期类型（格式: YYYY-MM-DD）
- `select`: 选择类型（从选项列表中选择）

**变量声明格式** (YAML front-matter):
```yaml
---
title: 文档标题
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
---
```

**变量使用** (文档内容):
```markdown
项目名称: {{project_name}}
服务器数量: {{server_count}} 台
```

#### 1.6 编辑器服务 (`service/editor.go`)

**职责**:
- 在线编辑 Markdown 文档
- 文件树管理
- 图片上传和管理
- 文件重命名和删除

**安全特性**:
- 路径验证（防止目录遍历）
- 文件类型验证（仅允许 .md 文件）
- 文件名验证（禁止特殊字符）

#### 1.7 Git 服务 (`service/git.go`)

**职责**:
- Git 仓库初始化
- 提交、推送、拉取
- 查看状态和历史
- 暂存区管理
- 凭据管理

**支持的操作**:
- `init`: 初始化仓库
- `status`: 查看状态
- `add`: 暂存文件
- `commit`: 提交变更
- `push`: 推送到远程
- `pull`: 从远程拉取
- `log`: 查看历史
- `remote`: 配置远程仓库

### 2. 前端模块 (`web/static/`)

#### 2.1 主应用 (`app.js`)

**职责**:
- 客户和文档类型选择
- 文档生成和下载
- 配置管理
- 变量填写

**核心功能**:
- 穿梭框式模块选择
- 拖拽排序
- 变量模板填写
- Toast 通知
- 深色模式支持

#### 2.2 编辑器 (`editor.js` + `editor/`)

**职责**:
- 在线编辑 Markdown 文档
- 文件树导航
- 标签页管理
- 实时预览
- 自动保存

**编辑器特性**:
- 基于 Vditor 的 Markdown 编辑器
- 支持图片上传和预览
- 支持附件管理
- 支持快捷键操作
- 支持命令面板
- 支持快速打开文件
- 支持历史记录

#### 2.3 Git 界面 (`git.js`)

**职责**:
- Git 操作界面
- 变更文件列表
- 提交历史
- 暂存区管理

### 3. 构建脚本模块

#### 3.1 Windows 构建脚本 (`build.ps1`)

**职责**:
- 解析命令行参数
- 读取客户配置
- 调用 Pandoc 生成文档
- 处理变量替换

**主要参数**:
```powershell
-Client <客户名>          # 指定客户
-Doc <文档类型>           # 指定文档类型
-ClientName <自定义名称>  # 自定义客户名称
-Format <word|pdf>        # 输出格式
-WorkDir <工作目录>       # 工作目录
-ListClients              # 列出所有客户
-ListDocs                 # 列出客户的文档类型
-ListModules              # 列出所有模块
-CheckPdfDeps             # 检查 PDF 依赖
-Clean                    # 清理构建目录
```

#### 3.2 Linux/macOS 构建脚本 (`bin/build.sh`)

**职责**: 与 Windows 脚本相同，但使用 Bash 语法

**主要参数**:
```bash
-c <客户名>               # 指定客户
-d <文档类型>             # 指定文档类型
-n <自定义名称>           # 自定义客户名称
-f <word|pdf>             # 输出格式
-w <工作目录>             # 工作目录
```

### 4. 配置文件格式

#### 4.1 客户配置 (`clients/<客户名>/<文档类型>.yaml`)

```yaml
# 文档元数据
title: "XX系统运维手册"
subtitle: "标准文档模板"
author: "运维团队"
date: "2026年1月"
version: "v1.0"

# 客户名称（用于文件名）
client_name: "标准文档"

# Word 模板
template: "default.docx"

# 文档模块列表
modules:
  - src/metadata.yaml
  - src/01-概述.md
  - src/02-系统架构.md
  # ...

# Pandoc 参数
pandoc_args:
  - "--toc"
  - "--toc-depth=3"
  - "--number-sections"
  - "--standalone"
  - "--highlight-style=tango"

# 输出文件名模式
output_pattern: "{client}_运维手册_{date}.docx"

# PDF 选项（可选）
pdf_options:
  mainfont: "Noto Sans CJK SC"
  CJKmainfont: "Noto Sans CJK SC"
  monofont: "Consolas"
  titlepage: true
  titlepage-color: "2C3E50"
  # ...

# 变量默认值（可选）
variables:
  project_name: "某客户系统"
  environment: "生产环境"
```

#### 4.2 客户元数据 (`clients/<客户名>/metadata.yaml`)

```yaml
---
title: "某客户文档"
subtitle: "为某客户定制"
author: "运维团队"
date: "2026年1月"
version: "v1.0"

client:
  name: "某客户"
  contact: "联系人"
  system: "系统名称"
---
```

---

## 🔧 开发指南

### 添加新的 API 端点

1. 在 `web/handler/api.go` 中添加处理函数
2. 在 `RegisterRoutes` 方法中注册路由
3. 在前端 `web/static/app.js` 中添加调用逻辑

### 添加新的服务

1. 在 `web/service/` 目录创建新文件
2. 定义服务结构体和方法
3. 在 `web/main.go` 中初始化服务
4. 在 `web/handler/api.go` 中注入服务

### 添加新的文档模块

1. 在 `src/` 目录创建新的 `.md` 文件
2. 在客户配置的 `modules` 列表中引用
3. 重新构建文档

### 添加新的客户配置

1. 在 `clients/` 目录创建新的客户目录
2. 创建文档类型配置文件（`.yaml`）
3. 可选：创建 `metadata.yaml` 覆盖默认元数据
4. 可选：创建 `.custom` 文件标记为自定义配置

---

## 🚀 部署指南

### Docker 部署

```bash
# 使用 Docker Compose
docker compose up -d

# 自定义端口
PORT=9000 docker compose up -d

# 自定义文档目录
DOCS_DIR=/path/to/docs docker compose up -d

# 组合配置
PORT=9000 DOCS_DIR=/custom/docs OUTPUT_DIR=/custom/output docker compose up -d
```

### 二进制部署

```bash
# 构建
cd web
go build -o doc-generator-web .

# 运行
cd ..
./web/doc-generator-web

# 或指定参数
./web/doc-generator-web -port 9000 -workdir /path/to/project
```

---

## 📝 常见问题

### 1. PDF 生成失败

**原因**: 缺少 PDF 依赖

**解决方案**:
```bash
# 检查依赖
./build.ps1 -CheckPdfDeps  # Windows
make check-pdf-deps        # Linux/macOS

# 安装依赖
# 1. 安装 TeX Live
# 2. 安装 Eisvogel 模板
# 3. 安装中文字体
```

### 2. 图片路径错误

**原因**: Markdown 中的图片路径不正确

**解决方案**:
- 构建服务会自动修复路径
- 或手动运行: `./bin/fix-image-paths.sh`

### 3. 变量替换不生效

**原因**: 
- 变量声明格式错误
- 变量名不匹配
- 未传递变量值

**解决方案**:
- 检查 YAML front-matter 格式
- 确保变量名使用 `{{variable_name}}` 格式
- 在 Web 界面或命令行传递变量值

---

## 🔍 代码风格约定

### Go 代码

- 使用 `gofmt` 格式化
- 使用 tabs 缩进
- 导入顺序: 标准库 → 第三方库 → 本地模块
- 错误处理: 提前返回，使用 `fmt.Errorf` 包装错误
- 命名: 导出类型/函数使用 `PascalCase`，未导出使用 `camelCase`

### JavaScript 代码

- 使用 `const`/`let`，避免 `var`
- 使用函数声明而非箭头函数（顶层）
- 事件监听在 `DOMContentLoaded` 中注册
- UI 状态存储在顶层变量

### Shell 脚本

- Bash: 使用 `set -e` 和命名函数
- PowerShell: 设置 `$ErrorActionPreference = "Stop"`
- 保持脚本简洁，避免不必要的重构

---

## 📚 相关文档

- [README.md](README.md) - 项目主文档
- [web/README.md](web/README.md) - Web 服务文档
- [CONTRIBUTING.md](CONTRIBUTING.md) - 贡献指南
- [AGENTS.md](AGENTS.md) - AI 代理指南
